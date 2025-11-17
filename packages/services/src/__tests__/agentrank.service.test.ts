import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionType } from "@recallnet/db/repositories/types";
import { SelectCompetitionsLeaderboard } from "@recallnet/db/schema/core/types";
import { Transaction } from "@recallnet/db/types";

import { AgentRankService } from "../agentrank.service.js";

/**
 * Helper to create mock leaderboard entry
 */
function createMockLeaderboardEntry(
  agentId: string,
  rank: number,
): SelectCompetitionsLeaderboard {
  return {
    id: randomUUID(),
    competitionId: "test-comp-id",
    agentId,
    rank,
    score: 1000 - rank * 10,
    totalAgents: 10,
    createdAt: new Date(),
  };
}

describe("AgentRankService", () => {
  let service: AgentRankService;
  let mockAgentScoreRepo: MockProxy<AgentScoreRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;
  let mockTx: MockProxy<Transaction>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgentScoreRepo = mock<AgentScoreRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();
    mockTx = mock<Transaction>();

    service = new AgentRankService(
      mockAgentScoreRepo,
      mockCompetitionRepo,
      mockLogger,
    );
  });

  describe("updateAgentRanksForCompetition", () => {
    const competitionId = "test-comp-id";
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();
    const agent3Id = randomUUID();

    const mockLeaderboard = [
      createMockLeaderboardEntry(agent1Id, 1),
      createMockLeaderboardEntry(agent2Id, 2),
      createMockLeaderboardEntry(agent3Id, 3),
    ];

    const mockCurrentRanks = [
      {
        id: agent1Id,
        name: "Agent 1",
        mu: 25.5,
        sigma: 8.2,
        score: 1500,
      },
      {
        id: agent2Id,
        name: "Agent 2",
        mu: 24.8,
        sigma: 8.3,
        score: 1480,
      },
    ];

    it("should update only global rankings when competition has no arena", async () => {
      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert
      expect(mockCompetitionRepo.getCompetitionMetadata).toHaveBeenCalledWith(
        competitionId,
        undefined,
      );
      expect(
        mockCompetitionRepo.findLeaderboardByCompetition,
      ).toHaveBeenCalledWith(competitionId, undefined);

      // Should call global update
      expect(mockAgentScoreRepo.getAllAgentRanks).toHaveBeenCalledWith({
        type: "trading",
      });
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: agent1Id }),
          expect.objectContaining({ agentId: agent2Id }),
          expect.objectContaining({ agentId: agent3Id }),
        ]),
        competitionId,
        "trading",
        undefined,
      );

      // Should NOT call arena-specific methods
      expect(
        mockAgentScoreRepo.getLatestArenaHistoryForAgents,
      ).not.toHaveBeenCalled();
      expect(mockAgentScoreRepo.batchUpdateArenaRanks).not.toHaveBeenCalled();
    });

    it("should update both global and arena rankings when competition has arena", async () => {
      const arenaId = "hyperliquid-perps";

      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "perpetual_futures" as CompetitionType,
        arenaId,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Mock arena-specific data
      const mockArenaHistory = [
        {
          agentId: agent1Id,
          mu: 26.0,
          sigma: 7.5,
          ordinal: 1520,
          createdAt: new Date("2025-01-01"),
        },
      ];
      mockAgentScoreRepo.getLatestArenaHistoryForAgents.mockResolvedValue(
        mockArenaHistory,
      );
      mockAgentScoreRepo.batchUpdateArenaRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert - Global update
      expect(mockAgentScoreRepo.getAllAgentRanks).toHaveBeenCalledWith({
        type: "perpetual_futures",
      });
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.any(Array),
        competitionId,
        "perpetual_futures",
        undefined,
      );

      // Assert - Arena update
      expect(
        mockAgentScoreRepo.getLatestArenaHistoryForAgents,
      ).toHaveBeenCalledWith(arenaId, [agent1Id, agent2Id, agent3Id]);
      expect(mockAgentScoreRepo.batchUpdateArenaRanks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: agent1Id }),
          expect.objectContaining({ agentId: agent2Id }),
          expect.objectContaining({ agentId: agent3Id }),
        ]),
        competitionId,
        arenaId,
        "perpetual_futures",
        undefined,
      );
    });

    it("should use transaction when provided", async () => {
      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId, mockTx);

      // Assert - Transaction passed to all repository calls
      expect(mockCompetitionRepo.getCompetitionMetadata).toHaveBeenCalledWith(
        competitionId,
        mockTx,
      );
      expect(
        mockCompetitionRepo.findLeaderboardByCompetition,
      ).toHaveBeenCalledWith(competitionId, mockTx);
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.any(Array),
        competitionId,
        "trading",
        mockTx,
      );
    });

    it("should handle competition not found", async () => {
      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue(null);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert - Should return early, not call other methods
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ competitionId }),
        expect.stringContaining("Competition not found"),
      );
      expect(
        mockCompetitionRepo.findLeaderboardByCompetition,
      ).not.toHaveBeenCalled();
      expect(mockAgentScoreRepo.getAllAgentRanks).not.toHaveBeenCalled();
    });

    it("should handle empty leaderboard", async () => {
      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert - Should return early
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ competitionId }),
        expect.stringContaining("No leaderboard entries"),
      );
      expect(mockAgentScoreRepo.getAllAgentRanks).not.toHaveBeenCalled();
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).not.toHaveBeenCalled();
    });

    it("should initialize default ratings for new agents", async () => {
      // Arrange - Agent 3 has no existing rank
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue([
        mockCurrentRanks[0]!, // Only agent 1 has existing rank
      ]);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert - All 3 agents should be updated (including agent 2 & 3 with default ratings)
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: agent1Id }),
          expect.objectContaining({ agentId: agent2Id }),
          expect.objectContaining({ agentId: agent3Id }),
        ]),
        competitionId,
        "trading",
        undefined,
      );
    });

    it("should use arena-specific history for arena rankings", async () => {
      const arenaId = "hyperliquid-perps";

      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "perpetual_futures" as CompetitionType,
        arenaId,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Mock arena history - agent1 has arena history, others don't
      const mockArenaHistory = [
        {
          agentId: agent1Id,
          mu: 27.0,
          sigma: 7.0,
          ordinal: 1600,
          createdAt: new Date("2025-01-01"),
        },
      ];
      mockAgentScoreRepo.getLatestArenaHistoryForAgents.mockResolvedValue(
        mockArenaHistory,
      );
      mockAgentScoreRepo.batchUpdateArenaRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert
      expect(
        mockAgentScoreRepo.getLatestArenaHistoryForAgents,
      ).toHaveBeenCalledWith(arenaId, [agent1Id, agent2Id, agent3Id]);

      // Should update all agents (agent1 with arena history, agents 2&3 with defaults)
      expect(mockAgentScoreRepo.batchUpdateArenaRanks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: agent1Id }),
          expect.objectContaining({ agentId: agent2Id }),
          expect.objectContaining({ agentId: agent3Id }),
        ]),
        competitionId,
        arenaId,
        "perpetual_futures",
        undefined,
      );
    });

    it("should propagate repository errors", async () => {
      // Arrange
      const error = new Error("Database connection failed");
      mockCompetitionRepo.getCompetitionMetadata.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.updateAgentRanksForCompetition(competitionId),
      ).rejects.toThrow("Database connection failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          error,
        }),
        expect.stringContaining("Error updating agent ranks"),
      );
    });

    it("should handle leaderboard with single agent", async () => {
      // Arrange
      const singleAgentLeaderboard = [createMockLeaderboardEntry(agent1Id, 1)];

      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        singleAgentLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue([]);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: agent1Id }),
        ]),
        competitionId,
        "trading",
        undefined,
      );
    });

    it("should log success for global-only updates", async () => {
      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "trading" as CompetitionType,
        arenaId: null,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          type: "trading",
          arenaId: "none",
          numAgents: 3,
          updatedGlobal: true,
          updatedArena: false,
        }),
        expect.stringContaining("Successfully updated ranks"),
      );
    });

    it("should log success for global + arena updates", async () => {
      const arenaId = "hyperliquid-perps";

      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "perpetual_futures" as CompetitionType,
        arenaId,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);
      mockAgentScoreRepo.getLatestArenaHistoryForAgents.mockResolvedValue([]);
      mockAgentScoreRepo.batchUpdateArenaRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          type: "perpetual_futures",
          arenaId,
          numAgents: 3,
          updatedGlobal: true,
          updatedArena: true,
        }),
        expect.stringContaining("Successfully updated ranks"),
      );
    });

    it("should pass transaction to all repository calls", async () => {
      const arenaId = "hyperliquid-perps";

      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "perpetual_futures" as CompetitionType,
        arenaId,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);
      mockAgentScoreRepo.getLatestArenaHistoryForAgents.mockResolvedValue([]);
      mockAgentScoreRepo.batchUpdateArenaRanks.mockResolvedValue([]);

      // Act
      await service.updateAgentRanksForCompetition(competitionId, mockTx);

      // Assert - All calls should include transaction
      expect(mockCompetitionRepo.getCompetitionMetadata).toHaveBeenCalledWith(
        competitionId,
        mockTx,
      );
      expect(
        mockCompetitionRepo.findLeaderboardByCompetition,
      ).toHaveBeenCalledWith(competitionId, mockTx);
      expect(mockAgentScoreRepo.batchUpdateAgentRanks).toHaveBeenCalledWith(
        expect.any(Array),
        competitionId,
        "perpetual_futures",
        mockTx,
      );
      expect(mockAgentScoreRepo.batchUpdateArenaRanks).toHaveBeenCalledWith(
        expect.any(Array),
        competitionId,
        arenaId,
        "perpetual_futures",
        mockTx,
      );
    });

    it("should handle arena update failure without breaking global update", async () => {
      const arenaId = "hyperliquid-perps";

      // Arrange
      mockCompetitionRepo.getCompetitionMetadata.mockResolvedValue({
        type: "perpetual_futures" as CompetitionType,
        arenaId,
      });
      mockCompetitionRepo.findLeaderboardByCompetition.mockResolvedValue(
        mockLeaderboard,
      );
      mockAgentScoreRepo.getAllAgentRanks.mockResolvedValue(mockCurrentRanks);
      mockAgentScoreRepo.batchUpdateAgentRanks.mockResolvedValue([]);
      mockAgentScoreRepo.getLatestArenaHistoryForAgents.mockRejectedValue(
        new Error("Arena DB error"),
      );

      // Act & Assert - Should propagate error (Promise.all fails if any promise fails)
      await expect(
        service.updateAgentRanksForCompetition(competitionId),
      ).rejects.toThrow("Arena DB error");
    });
  });
});
