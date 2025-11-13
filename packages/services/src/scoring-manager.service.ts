import { Logger } from "pino";

import { CompetitionScoresRepository } from "@recallnet/db/repositories/competition-scores";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { PredictionsRepository } from "@recallnet/db/repositories/predictions";
import { SelectCompetitionScore } from "@recallnet/db/schema/sports/types";

/**
 * Leaderboard entry with calculated metrics
 */
export interface LeaderboardEntry {
  agentId: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  brierScore: number;
  rank: number;
}

/**
 * Scoring Manager Service
 * Handles business logic for scoring predictions and calculating leaderboards
 */
export class ScoringManagerService {
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #predictionsRepo: PredictionsRepository;
  readonly #competitionScoresRepo: CompetitionScoresRepository;
  readonly #logger: Logger;

  constructor(
    gamePlaysRepo: GamePlaysRepository,
    predictionsRepo: PredictionsRepository,
    competitionScoresRepo: CompetitionScoresRepository,
    logger: Logger,
  ) {
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#predictionsRepo = predictionsRepo;
    this.#competitionScoresRepo = competitionScoresRepo;
    this.#logger = logger;
  }

  /**
   * Calculate Brier score term for a single prediction
   * Brier score = (confidence - actual)^2
   * where actual is 1 if prediction matches outcome, 0 otherwise
   *
   * @param prediction Predicted outcome
   * @param confidence Confidence level (0-1)
   * @param actualOutcome Actual outcome
   * @returns Brier score term
   */
  private calculateBrierTerm(
    prediction: "run" | "pass",
    confidence: number,
    actualOutcome: "run" | "pass",
  ): number {
    // Convert to probability of "pass"
    const predictedProb = prediction === "pass" ? confidence : 1 - confidence;
    const actualProb = actualOutcome === "pass" ? 1 : 0;

    return Math.pow(predictedProb - actualProb, 2);
  }

  /**
   * Score predictions for a resolved play
   * @param playId Play ID
   * @returns Number of predictions scored
   */
  async scorePlay(playId: string): Promise<number> {
    try {
      // Get the resolved play
      const play = await this.#gamePlaysRepo.findById(playId);
      if (!play) {
        throw new Error(`Play ${playId} not found`);
      }

      if (play.status !== "resolved" || !play.actualOutcome) {
        throw new Error(
          `Play ${playId} is not resolved (status: ${play.status})`,
        );
      }

      // Get all predictions for this play
      const predictions = await this.#predictionsRepo.findByPlayId(playId);

      if (predictions.length === 0) {
        this.#logger.info(`No predictions found for play ${playId}`);
        return 0;
      }

      // Score each prediction and update aggregates
      for (const prediction of predictions) {
        const isCorrect = prediction.prediction === play.actualOutcome;
        const confidence = Number(prediction.confidence);
        const brierTerm = this.calculateBrierTerm(
          prediction.prediction,
          confidence,
          play.actualOutcome,
        );

        await this.#competitionScoresRepo.increment(
          prediction.competitionId,
          prediction.agentId,
          isCorrect,
          brierTerm,
        );

        this.#logger.debug(
          `Scored prediction ${prediction.id}: correct=${isCorrect}, brier=${brierTerm.toFixed(4)}`,
        );
      }

      this.#logger.info(
        `Scored ${predictions.length} predictions for play ${playId}`,
      );
      return predictions.length;
    } catch (error) {
      this.#logger.error({ error, playId }, "Error in scorePlay");
      throw error;
    }
  }

  /**
   * Get leaderboard for a competition
   * @param competitionId Competition ID
   * @returns Leaderboard entries sorted by accuracy (then Brier score)
   */
  async getLeaderboard(competitionId: string): Promise<LeaderboardEntry[]> {
    try {
      const scores =
        await this.#competitionScoresRepo.findByCompetition(competitionId);

      // Calculate metrics and rank
      const entries: LeaderboardEntry[] = scores.map((score) => {
        const totalPredictions = score.totalPredictions;
        const correctPredictions = score.correctPredictions;
        const accuracy =
          totalPredictions > 0 ? correctPredictions / totalPredictions : 0;

        // Brier score: lower is better, normalized by number of predictions
        const brierSum = Number(score.brierSum);
        const brierScore =
          totalPredictions > 0 ? brierSum / totalPredictions : 0;

        return {
          agentId: score.agentId,
          totalPredictions,
          correctPredictions,
          accuracy,
          brierScore,
          rank: 0, // Will be set below
        };
      });

      // Sort by accuracy (desc), then by Brier score (asc)
      entries.sort((a, b) => {
        if (a.accuracy !== b.accuracy) {
          return b.accuracy - a.accuracy;
        }
        return a.brierScore - b.brierScore;
      });

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (error) {
      this.#logger.error({ error, competitionId }, "Error in getLeaderboard");
      throw error;
    }
  }

  /**
   * Get score for a specific agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns Competition score or undefined
   */
  async getAgentScore(
    competitionId: string,
    agentId: string,
  ): Promise<SelectCompetitionScore | undefined> {
    try {
      return await this.#competitionScoresRepo.findByCompetitionAndAgent(
        competitionId,
        agentId,
      );
    } catch (error) {
      this.#logger.error(
        { error, competitionId, agentId },
        "Error in getAgentScore",
      );
      throw error;
    }
  }
}
