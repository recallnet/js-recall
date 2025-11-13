import { randomUUID } from "crypto";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionScoresRepository } from "@recallnet/db/repositories/competition-scores";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { PredictionsRepository } from "@recallnet/db/repositories/predictions";
import {
  SelectCompetitionScore,
  SelectGamePlay,
  SelectPrediction,
} from "@recallnet/db/schema/sports/types";

import { ScoringManagerService } from "../scoring-manager.service.js";

describe("ScoringManagerService", () => {
  let scoringService: ScoringManagerService;
  let gamePlaysRepo: MockProxy<GamePlaysRepository>;
  let predictionsRepo: MockProxy<PredictionsRepository>;
  let competitionScoresRepo: MockProxy<CompetitionScoresRepository>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    gamePlaysRepo = mock<GamePlaysRepository>();
    predictionsRepo = mock<PredictionsRepository>();
    competitionScoresRepo = mock<CompetitionScoresRepository>();
    mockLogger = mock<Logger>();

    scoringService = new ScoringManagerService(
      gamePlaysRepo,
      predictionsRepo,
      competitionScoresRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("scorePlay", () => {
    it("should score a resolved play with correct predictions", async () => {
      const playId = randomUUID();
      const competitionId = randomUUID();
      const agentId1 = randomUUID();
      const agentId2 = randomUUID();

      const resolvedPlay: SelectGamePlay = {
        id: playId,
        gameId: randomUUID(),
        providerPlayId: "1234567890",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 15,
        timeRemainingSeconds: 15,
        playTime: new Date(),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "DAL",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "DAL",
        opponent: "WAS",
        description: "Dak Prescott pass complete to CeeDee Lamb for 15 yards",
        lockTime: new Date(),
        status: "resolved",
        actualOutcome: "pass",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const predictions: SelectPrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gamePlayId: playId,
          agentId: agentId1,
          prediction: "pass",
          confidence: "0.8",
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          competitionId,
          gamePlayId: playId,
          agentId: agentId2,
          prediction: "run",
          confidence: "0.6",
          createdAt: new Date(),
        },
      ];

      gamePlaysRepo.findById.mockResolvedValue(resolvedPlay);
      predictionsRepo.findByPlayId.mockResolvedValue(predictions);
      competitionScoresRepo.increment.mockResolvedValue(
        {} as SelectCompetitionScore,
      );

      const result = await scoringService.scorePlay(playId);

      expect(result).toBe(2);
      expect(gamePlaysRepo.findById).toHaveBeenCalledWith(playId);
      expect(predictionsRepo.findByPlayId).toHaveBeenCalledWith(playId);

      // Agent 1 predicted correctly (pass = pass)
      expect(competitionScoresRepo.increment).toHaveBeenCalledWith(
        competitionId,
        agentId1,
        true,
        expect.any(Number),
      );

      // Agent 2 predicted incorrectly (run != pass)
      expect(competitionScoresRepo.increment).toHaveBeenCalledWith(
        competitionId,
        agentId2,
        false,
        expect.any(Number),
      );
    });

    it("should calculate Brier scores correctly", async () => {
      const playId = randomUUID();
      const competitionId = randomUUID();
      const agentId = randomUUID();

      const resolvedPlay: SelectGamePlay = {
        id: playId,
        gameId: randomUUID(),
        providerPlayId: "1234567890",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 15,
        timeRemainingSeconds: 15,
        playTime: new Date(),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "DAL",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "DAL",
        opponent: "WAS",
        description: "Dak Prescott pass complete to CeeDee Lamb for 15 yards",
        lockTime: new Date(),
        status: "resolved",
        actualOutcome: "pass",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const prediction: SelectPrediction = {
        id: randomUUID(),
        competitionId,
        gamePlayId: playId,
        agentId,
        prediction: "pass",
        confidence: "0.7",
        createdAt: new Date(),
      };

      gamePlaysRepo.findById.mockResolvedValue(resolvedPlay);
      predictionsRepo.findByPlayId.mockResolvedValue([prediction]);
      competitionScoresRepo.increment.mockResolvedValue(
        {} as SelectCompetitionScore,
      );

      await scoringService.scorePlay(playId);

      // For "pass" prediction with 0.7 confidence and actual "pass":
      // predictedProb = 0.7, actualProb = 1
      // brierTerm = (0.7 - 1)^2 = 0.09
      expect(competitionScoresRepo.increment).toHaveBeenCalledWith(
        competitionId,
        agentId,
        true,
        0.09,
      );
    });

    it("should throw error if play is not resolved", async () => {
      const playId = randomUUID();

      const unresolvedPlay: SelectGamePlay = {
        id: playId,
        gameId: randomUUID(),
        providerPlayId: "1234567890",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 15,
        timeRemainingSeconds: 15,
        playTime: new Date(),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "DAL",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "DAL",
        opponent: "WAS",
        description: "Dak Prescott pass complete to CeeDee Lamb for 15 yards",
        lockTime: new Date(Date.now() + 5000 * 1000),
        status: "open",
        actualOutcome: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      gamePlaysRepo.findById.mockResolvedValue(unresolvedPlay);

      await expect(scoringService.scorePlay(playId)).rejects.toThrow(
        "Play " + playId + " is not resolved",
      );
    });

    it("should handle play with no predictions", async () => {
      const playId = randomUUID();

      const resolvedPlay: SelectGamePlay = {
        id: playId,
        gameId: randomUUID(),
        providerPlayId: "1234567890",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 15,
        timeRemainingSeconds: 15,
        playTime: new Date(),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "DAL",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "DAL",
        opponent: "WAS",
        description: "Dak Prescott pass complete to CeeDee Lamb for 15 yards",
        lockTime: new Date(Date.now() + 5000 * 1000),
        status: "resolved",
        actualOutcome: "run",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      gamePlaysRepo.findById.mockResolvedValue(resolvedPlay);
      predictionsRepo.findByPlayId.mockResolvedValue([]);

      const result = await scoringService.scorePlay(playId);

      expect(result).toBe(0);
      expect(competitionScoresRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe("getLeaderboard", () => {
    it("should return sorted leaderboard with calculated metrics", async () => {
      const competitionId = randomUUID();

      const scores: SelectCompetitionScore[] = [
        {
          id: randomUUID(),
          competitionId,
          agentId: "agent1",
          totalPredictions: 10,
          correctPredictions: 8,
          brierSum: "1.5",
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          competitionId,
          agentId: "agent2",
          totalPredictions: 10,
          correctPredictions: 6,
          brierSum: "2.0",
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          competitionId,
          agentId: "agent3",
          totalPredictions: 10,
          correctPredictions: 8,
          brierSum: "1.2",
          updatedAt: new Date(),
        },
      ];

      competitionScoresRepo.findByCompetition.mockResolvedValue(scores);

      const leaderboard = await scoringService.getLeaderboard(competitionId);

      expect(leaderboard).toHaveLength(3);

      // Check sorting: agent3 (80% accuracy, 0.12 Brier) > agent1 (80% accuracy, 0.15 Brier) > agent2 (60% accuracy)
      expect(leaderboard[0]!.agentId).toBe("agent3");
      expect(leaderboard[0]!.rank).toBe(1);
      expect(leaderboard[0]!.accuracy).toBe(0.8);
      expect(leaderboard[0]!.brierScore).toBeCloseTo(0.12);

      expect(leaderboard[1]!.agentId).toBe("agent1");
      expect(leaderboard[1]!.rank).toBe(2);
      expect(leaderboard[1]!.accuracy).toBe(0.8);
      expect(leaderboard[1]!.brierScore).toBeCloseTo(0.15);

      expect(leaderboard[2]!.agentId).toBe("agent2");
      expect(leaderboard[2]!.rank).toBe(3);
      expect(leaderboard[2]!.accuracy).toBe(0.6);
      expect(leaderboard[2]!.brierScore).toBeCloseTo(0.2);
    });

    it("should handle agents with no predictions", async () => {
      const competitionId = randomUUID();

      const scores: SelectCompetitionScore[] = [
        {
          id: randomUUID(),
          competitionId,
          agentId: "agent1",
          totalPredictions: 0,
          correctPredictions: 0,
          brierSum: "0",
          updatedAt: new Date(),
        },
      ];

      competitionScoresRepo.findByCompetition.mockResolvedValue(scores);

      const leaderboard = await scoringService.getLeaderboard(competitionId);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0]!.accuracy).toBe(0);
      expect(leaderboard[0]!.brierScore).toBe(0);
    });
  });

  describe("getAgentScore", () => {
    it("should return score for specific agent", async () => {
      const competitionId = randomUUID();
      const agentId = randomUUID();

      const score: SelectCompetitionScore = {
        id: randomUUID(),
        competitionId,
        agentId,
        totalPredictions: 5,
        correctPredictions: 4,
        brierSum: "0.8",
        updatedAt: new Date(),
      };

      competitionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(score);

      const result = await scoringService.getAgentScore(competitionId, agentId);

      expect(result).toEqual(score);
      expect(
        competitionScoresRepo.findByCompetitionAndAgent,
      ).toHaveBeenCalledWith(competitionId, agentId);
    });

    it("should return undefined if score not found", async () => {
      const competitionId = randomUUID();
      const agentId = randomUUID();

      competitionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(
        undefined,
      );

      const result = await scoringService.getAgentScore(competitionId, agentId);

      expect(result).toBeUndefined();
    });
  });
});
