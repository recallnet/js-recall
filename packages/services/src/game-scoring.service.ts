import { Logger } from "pino";

import { CompetitionAggregateScoresRepository } from "@recallnet/db/repositories/competition-aggregate-scores";
import { GamePredictionScoresRepository } from "@recallnet/db/repositories/game-prediction-scores";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { SelectGamePrediction } from "@recallnet/db/schema/sports/types";

/**
 * Leaderboard entry for a single game
 */
export interface GameLeaderboardEntry {
  agentId: string;
  timeWeightedBrierScore: number;
  finalPrediction: string | null;
  finalConfidence: number | null;
  predictionCount: number;
  rank: number;
}

/**
 * Leaderboard entry for overall competition
 */
export interface CompetitionLeaderboardEntry {
  agentId: string;
  averageBrierScore: number;
  gamesScored: number;
  rank: number;
}

/**
 * Game Scoring Service
 * Handles time-weighted Brier scoring for game winner predictions
 */
export class GameScoringService {
  readonly #gamePredictionsRepo: GamePredictionsRepository;
  readonly #gamePredictionScoresRepo: GamePredictionScoresRepository;
  readonly #competitionAggregateScoresRepo: CompetitionAggregateScoresRepository;
  readonly #gamesRepo: GamesRepository;
  readonly #logger: Logger;

  constructor(
    gamePredictionsRepo: GamePredictionsRepository,
    gamePredictionScoresRepo: GamePredictionScoresRepository,
    competitionAggregateScoresRepo: CompetitionAggregateScoresRepository,
    gamesRepo: GamesRepository,
    logger: Logger,
  ) {
    this.#gamePredictionsRepo = gamePredictionsRepo;
    this.#gamePredictionScoresRepo = gamePredictionScoresRepo;
    this.#competitionAggregateScoresRepo = competitionAggregateScoresRepo;
    this.#gamesRepo = gamesRepo;
    this.#logger = logger;
  }

  /**
   * Calculate time-weighted Brier score for a set of predictions
   * Formula: Score = 1 - Σ(w_t * (p_t - y)²) / Σ(w_t)
   * where:
   * - t = (timestamp - game_start) / (game_end - game_start) ∈ [0, 1]
   * - w_t = 0.5 + 0.5 * t (weight increases over time)
   * - p_t = confidence if predicted winner matches actual, else 1-confidence
   * - y = 1 (actual winner)
   *
   * @param predictions Array of predictions with timestamps
   * @param gameStart Game start time
   * @param gameEnd Game end time
   * @param actualWinner Actual winning team
   * @returns Time-weighted Brier score (higher is better, 0-1 range)
   */
  #calculateTimeWeightedBrier(
    predictions: SelectGamePrediction[],
    gameStart: Date,
    gameEnd: Date,
    actualWinner: string,
  ): number {
    if (predictions.length === 0) {
      return 0;
    }

    const gameStartMs = gameStart.getTime();
    const gameEndMs = gameEnd.getTime();
    const gameDuration = gameEndMs - gameStartMs;

    if (gameDuration <= 0) {
      throw new Error("Invalid game duration");
    }

    let weightedErrorSum = 0;
    let weightSum = 0;

    for (const prediction of predictions) {
      const predictionTime = prediction.createdAt.getTime();

      // Calculate normalized time t ∈ [0, 1]
      let t = (predictionTime - gameStartMs) / gameDuration;

      // Clamp t to [0, 1] (predictions before game start get t=0)
      t = Math.max(0, Math.min(1, t));

      // Calculate weight w_t = 0.5 + 0.5 * t
      const weight = 0.5 + 0.5 * t;

      // Calculate probability p_t
      const confidence = Number(prediction.confidence);
      const p_t =
        prediction.predictedWinner === actualWinner
          ? confidence
          : 1 - confidence;

      // y = 1 (actual winner)
      const y = 1;

      // Brier term: (p_t - y)²
      const brierTerm = Math.pow(p_t - y, 2);

      weightedErrorSum += weight * brierTerm;
      weightSum += weight;
    }

    // Final score: 1 - (weighted error sum / weight sum)
    const score = 1 - weightedErrorSum / weightSum;

    return score;
  }

  /**
   * Score all predictions for a completed game
   * @param gameId Game ID
   * @returns Number of agents scored
   */
  async scoreGame(gameId: string): Promise<number> {
    try {
      // Get game details
      const game = await this.#gamesRepo.findById(gameId);
      if (!game) {
        throw new Error(`Game ${gameId} not found`);
      }

      if (game.status !== "final") {
        throw new Error(`Game ${gameId} is not final (status: ${game.status})`);
      }

      if (!game.endTime) {
        throw new Error(`Game ${gameId} has no end time`);
      }

      if (!game.winner) {
        throw new Error(`Game ${gameId} has no winner`);
      }

      // Get all predictions for this game
      const allPredictions = await this.#gamePredictionsRepo.findByGame(gameId);

      if (allPredictions.length === 0) {
        this.#logger.info(`No predictions found for game ${gameId}`);
        return 0;
      }

      // Group predictions by agent
      const predictionsByAgent = new Map<string, SelectGamePrediction[]>();
      for (const prediction of allPredictions) {
        const agentPredictions =
          predictionsByAgent.get(prediction.agentId) || [];
        agentPredictions.push(prediction);
        predictionsByAgent.set(prediction.agentId, agentPredictions);
      }

      this.#logger.info(
        `Scoring game ${gameId} for ${predictionsByAgent.size} agents`,
      );

      let scoredCount = 0;

      // Score each agent
      for (const [agentId, predictions] of predictionsByAgent.entries()) {
        try {
          // Calculate time-weighted Brier score
          const timeWeightedBrierScore = this.#calculateTimeWeightedBrier(
            predictions,
            game.startTime,
            game.endTime,
            game.winner,
          );

          // Get final prediction (most recent)
          const finalPrediction = predictions[0]; // Already sorted by createdAt desc

          // Store per-game score
          await this.#gamePredictionScoresRepo.upsert({
            competitionId: predictions[0]!.competitionId,
            gameId,
            agentId,
            timeWeightedBrierScore: timeWeightedBrierScore.toString(),
            finalPrediction: finalPrediction?.predictedWinner || null,
            finalConfidence: finalPrediction?.confidence || null,
            predictionCount: predictions.length,
          });

          // Update competition aggregate
          await this.#updateCompetitionAggregate(
            predictions[0]!.competitionId,
            agentId,
          );

          scoredCount++;

          this.#logger.debug(
            {
              gameId,
              agentId,
              score: timeWeightedBrierScore,
              predictionCount: predictions.length,
            },
            "Scored agent for game",
          );
        } catch (error) {
          this.#logger.error(
            { error, gameId, agentId },
            "Error scoring agent for game",
          );
          // Continue with other agents
        }
      }

      this.#logger.info(`Scored ${scoredCount} agents for game ${gameId}`);
      return scoredCount;
    } catch (error) {
      this.#logger.error({ error, gameId }, "Error in scoreGame");
      throw error;
    }
  }

  /**
   * Update competition aggregate score for an agent
   * Calculates average Brier score across all scored games
   */
  async #updateCompetitionAggregate(
    competitionId: string,
    agentId: string,
  ): Promise<void> {
    // Get all game scores for this agent in this competition
    const gameScores =
      await this.#gamePredictionScoresRepo.findByCompetitionAndAgent(
        competitionId,
        agentId,
      );

    if (gameScores.length === 0) {
      return;
    }

    // Calculate average Brier score
    const totalBrier = gameScores.reduce(
      (sum, score) => sum + Number(score.timeWeightedBrierScore),
      0,
    );
    const averageBrier = totalBrier / gameScores.length;

    // Upsert aggregate
    await this.#competitionAggregateScoresRepo.upsert({
      competitionId,
      agentId,
      averageBrierScore: averageBrier.toString(),
      gamesScored: gameScores.length,
    });
  }

  /**
   * Get leaderboard for a specific game
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @returns Leaderboard entries sorted by score (descending)
   */
  async getGameLeaderboard(
    competitionId: string,
    gameId: string,
  ): Promise<GameLeaderboardEntry[]> {
    try {
      const scores =
        await this.#gamePredictionScoresRepo.findByCompetitionAndGame(
          competitionId,
          gameId,
        );

      // Convert to leaderboard entries and sort
      const entries: GameLeaderboardEntry[] = scores
        .map((score) => ({
          agentId: score.agentId,
          timeWeightedBrierScore: Number(score.timeWeightedBrierScore),
          finalPrediction: score.finalPrediction,
          finalConfidence: score.finalConfidence
            ? Number(score.finalConfidence)
            : null,
          predictionCount: score.predictionCount,
          rank: 0, // Will be set below
        }))
        .sort((a, b) => b.timeWeightedBrierScore - a.timeWeightedBrierScore);

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (error) {
      this.#logger.error(
        { error, competitionId, gameId },
        "Error in getGameLeaderboard",
      );
      throw error;
    }
  }

  /**
   * Get overall competition leaderboard
   * @param competitionId Competition ID
   * @returns Leaderboard entries sorted by average Brier score (descending)
   */
  async getCompetitionLeaderboard(
    competitionId: string,
  ): Promise<CompetitionLeaderboardEntry[]> {
    try {
      const scores =
        await this.#competitionAggregateScoresRepo.findByCompetition(
          competitionId,
        );

      // Convert to leaderboard entries (already sorted by averageBrierScore asc in repo)
      const entries: CompetitionLeaderboardEntry[] = scores.map(
        (score, index) => ({
          agentId: score.agentId,
          averageBrierScore: Number(score.averageBrierScore),
          gamesScored: score.gamesScored,
          rank: index + 1,
        }),
      );

      // Sort by average Brier score descending (higher is better)
      entries.sort((a, b) => b.averageBrierScore - a.averageBrierScore);

      // Reassign ranks after sorting
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (error) {
      this.#logger.error(
        { error, competitionId },
        "Error in getCompetitionLeaderboard",
      );
      throw error;
    }
  }
}
