import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionAggregateScoresRepository } from "@recallnet/db/repositories/competition-aggregate-scores";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePredictionScoresRepository } from "@recallnet/db/repositories/game-prediction-scores";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import {
  NflTeam,
  SelectGame,
  SelectGamePrediction,
} from "@recallnet/db/schema/sports/types";
import { Database, Transaction } from "@recallnet/db/types";

/**
 * Leaderboard entry for a single game
 */
export interface GameLeaderboardEntry {
  agentId: string;
  agentName: string | null;
  timeWeightedBrierScore: number;
  finalPrediction: NflTeam | null;
  finalConfidence: number | null;
  predictionCount: number;
  rank: number;
}

/**
 * Leaderboard entry for overall competition
 */
export interface CompetitionLeaderboardEntry {
  agentId: string;
  agentName: string | null;
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
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #competitionRepo: CompetitionRepository;
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(
    gamePredictionsRepo: GamePredictionsRepository,
    gamePredictionScoresRepo: GamePredictionScoresRepository,
    competitionAggregateScoresRepo: CompetitionAggregateScoresRepository,
    gamesRepo: GamesRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    competitionRepo: CompetitionRepository,
    db: Database,
    logger: Logger,
  ) {
    this.#gamePredictionsRepo = gamePredictionsRepo;
    this.#gamePredictionScoresRepo = gamePredictionScoresRepo;
    this.#competitionAggregateScoresRepo = competitionAggregateScoresRepo;
    this.#gamesRepo = gamesRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#competitionRepo = competitionRepo;
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Calculate time-weighted Brier score for a set of predictions
   * Formula: Score = 1 - Σ(w_t * (p_t - y)²) / Σ(w_t)
   * where:
   * - t = (timestamp - game_start) / (game_end - game_start) ∈ [0, 1]
   * - w_t = 1 - 0.75 * t (weight tapers as the game progresses)
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

      // Calculate weight w_t = 1 - 0.75 * t
      const weight = 1 - 0.75 * t;

      // Calculate probability p_t
      const confidence = prediction.confidence;
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

      // Validate game duration
      const gameDuration = game.endTime.getTime() - game.startTime.getTime();
      if (gameDuration <= 0) {
        throw new Error(
          `Game ${gameId} has invalid duration: ` +
            `start=${game.startTime.toISOString()}, end=${game.endTime.toISOString()}, ` +
            `duration=${gameDuration}ms. End time must be after start time.`,
        );
      }

      const competitionIds =
        await this.#competitionGamesRepo.findCompetitionIdsByGameId(gameId);

      if (competitionIds.length === 0) {
        this.#logger.info(
          { gameId },
          "Game is not linked to any competitions; skipping scoring",
        );
        return 0;
      }

      let totalScored = 0;
      for (const competitionId of competitionIds) {
        const validPredictions = await this.#gamePredictionsRepo.findByGame(
          gameId,
          competitionId,
          {
            startTime: game.startTime,
            endTime: game.endTime,
          },
        );

        if (validPredictions.length === 0) {
          this.#logger.info(
            {
              gameId,
              competitionId,
            },
            "No valid predictions found for competition; recording zero scores",
          );
        }

        totalScored += await this.#scoreCompetitionPredictions(
          competitionId,
          game,
          validPredictions,
        );
      }

      this.#logger.info(`Scored ${totalScored} agents for game ${gameId}`);
      return totalScored;
    } catch (error) {
      this.#logger.error({ error, gameId }, "Error in scoreGame");
      throw error;
    }
  }

  async #scoreCompetitionPredictions(
    competitionId: string,
    game: SelectGame,
    predictions: SelectGamePrediction[],
  ): Promise<number> {
    // Get all active agents and score them, irrespective of whether they have predictions
    const registeredAgentIds =
      await this.#competitionRepo.getAgents(competitionId);
    const predictionsByAgent = new Map<string, SelectGamePrediction[]>();

    for (const agentId of registeredAgentIds) {
      predictionsByAgent.set(agentId, []);
    }
    for (const prediction of predictions) {
      const agentPredictions = predictionsByAgent.get(prediction.agentId) || [];
      agentPredictions.push(prediction);
      predictionsByAgent.set(prediction.agentId, agentPredictions);
    }
    const agentsWithPredictions = Array.from(
      predictionsByAgent.entries(),
    ).filter(([, preds]) => preds.length > 0).length;

    this.#logger.info(
      {
        competitionId,
        agentsWithPredictions,
        agentsWithNoPredictions:
          registeredAgentIds.length - agentsWithPredictions,
        totalRegisteredAgents: registeredAgentIds.length,
      },
      "Scoring competition predictions",
    );

    let scoredCount = 0;
    if (!game.endTime || !game.winner) {
      throw new Error(`Cannot score game ${game.id}: game is not completed`);
    }

    // Agents with predictions get calculated scores, and those without any predictions get a score of 0
    for (const [agentId, agentPredictions] of predictionsByAgent.entries()) {
      try {
        const hasPredictions = agentPredictions.length > 0;
        const timeWeightedBrierScore = hasPredictions
          ? this.#calculateTimeWeightedBrier(
              agentPredictions,
              game.startTime,
              game.endTime,
              game.winner,
            )
          : 0;

        const finalPrediction = agentPredictions[0];

        await this.#db.transaction(async (tx) => {
          await this.#gamePredictionScoresRepo.upsert(
            {
              competitionId,
              gameId: game.id,
              agentId,
              timeWeightedBrierScore,
              finalPrediction: finalPrediction?.predictedWinner || null,
              finalConfidence: finalPrediction?.confidence ?? null,
              predictionCount: agentPredictions.length,
            },
            tx,
          );

          await this.#updateCompetitionAggregate(competitionId, agentId, tx);
        });

        scoredCount++;

        this.#logger.debug(
          {
            gameId: game.id,
            agentId,
            competitionId,
            score: timeWeightedBrierScore,
            predictionCount: agentPredictions.length,
          },
          "Scored agent for game",
        );
      } catch (error) {
        this.#logger.error(
          { error, gameId: game.id, agentId, competitionId },
          "Error scoring agent for game",
        );
      }
    }

    return scoredCount;
  }

  /**
   * Update competition aggregate score for an agent
   * Calculates average Brier score across all scored games
   */
  async #updateCompetitionAggregate(
    competitionId: string,
    agentId: string,
    tx: Transaction,
  ): Promise<void> {
    // Get all game scores for this agent in this competition
    const gameScores =
      await this.#gamePredictionScoresRepo.findByCompetitionAndAgent(
        competitionId,
        agentId,
        tx,
      );

    if (gameScores.length === 0) {
      return;
    }

    // Calculate average Brier score
    const totalBrier = gameScores.reduce(
      (sum, score) => sum + score.timeWeightedBrierScore,
      0,
    );
    const averageBrier = totalBrier / gameScores.length;

    await this.#competitionAggregateScoresRepo.upsert(
      {
        competitionId,
        agentId,
        averageBrierScore: averageBrier,
        gamesScored: gameScores.length,
      },
      tx,
    );
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
          agentName: score.agentName ?? null,
          timeWeightedBrierScore: score.timeWeightedBrierScore,
          finalPrediction: score.finalPrediction,
          finalConfidence: score.finalConfidence ?? null,
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
          agentName: score.agentName ?? null,
          averageBrierScore: score.averageBrierScore,
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
