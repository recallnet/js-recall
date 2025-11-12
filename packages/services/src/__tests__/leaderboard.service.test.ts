import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockedObject } from "vitest";
import { mock } from "vitest-mock-extended";

import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";

import { LeaderboardService } from "../leaderboard.service.js";
import type {
  BenchmarkLeaderboardData,
  BenchmarkModel,
} from "../types/unified-leaderboard.js";

// Mock dependencies
vi.mock("@recallnet/db/repositories/leaderboard");

describe("LeaderboardService", () => {
  let service: LeaderboardService;
  let mockRepo: MockedObject<LeaderboardRepository>;
  let mockArenaRepo: ReturnType<typeof mock<ArenaRepository>>;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repository
    mockRepo = {
      getStatsForCompetitionType: vi.fn(),
      getGlobalAgentMetricsForType: vi.fn(),
      getTotalRankedAgents: vi.fn(),
    } as unknown as MockedObject<LeaderboardRepository>;

    // Create mock arena repository
    mockArenaRepo = mock<ArenaRepository>();

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as unknown as Logger;

    service = new LeaderboardService(mockRepo, mockArenaRepo, mockLogger);
  });

  describe("getUnifiedLeaderboard", () => {
    // Helper to create mock benchmark data
    const createMockBenchmarkData = (
      includeTrading = true,
      includeFutures = false,
    ): BenchmarkLeaderboardData => {
      const skills: BenchmarkLeaderboardData["skills"] = {
        coding: {
          id: "coding",
          name: "Coding",
          description: "Coding benchmark",
          category: "benchmark",
          displayOrder: 1,
          isEnabled: true,
        },
        math: {
          id: "math",
          name: "Math",
          description: "Math benchmark",
          category: "benchmark",
          displayOrder: 2,
          isEnabled: true,
        },
      };

      if (includeTrading) {
        skills.crypto_trading = {
          id: "crypto_trading",
          name: "Crypto Trading",
          description: "Crypto trading skill",
          category: "trading",
          displayOrder: 3,
          isEnabled: true,
        };
      }

      if (includeFutures) {
        skills.perpetual_futures = {
          id: "perpetual_futures",
          name: "Perpetual Futures",
          description: "Perpetual futures trading",
          category: "perpetual_futures",
          displayOrder: 4,
          isEnabled: true,
        };
      }

      const models: BenchmarkModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "OpenAI",
          modelFamily: "GPT",
          scores: {
            coding: {
              rawScore: 85.5,
              rank: 1,
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
            math: {
              rawScore: 92.3,
              rank: 2,
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
        {
          id: "claude-3",
          name: "Claude 3",
          provider: "Anthropic",
          modelFamily: "Claude",
          scores: {
            coding: {
              rawScore: 88.2,
              rank: 2,
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
            math: {
              rawScore: 95.1,
              rank: 1,
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
        {
          id: "gemini-pro",
          name: "Gemini Pro",
          provider: "Google",
          modelFamily: "Gemini",
          scores: {
            coding: {
              rawScore: 82.7,
              rank: 3,
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
      ];

      return {
        metadata: {
          lastUpdated: "2024-01-01T00:00:00Z",
          benchmarkLink: "https://example.com/benchmark",
        },
        skills,
        models,
        skillStats: {
          coding: {
            totalModels: 3,
            avgScore: 85.47,
            topScore: 88.2,
            medianScore: 85.5,
            evaluationCount: 3,
          },
          math: {
            totalModels: 2,
            avgScore: 93.7,
            topScore: 95.1,
            medianScore: 93.7,
            evaluationCount: 2,
          },
        },
      };
    };

    // Helper to create mock agent data
    const createMockAgents = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: `agent-${i + 1}`,
        name: `Test Agent ${i + 1}`,
        handle: `agent${i + 1}`,
        description: `Description ${i + 1}`,
        imageUrl: `https://example.com/avatar${i + 1}.png`,
        metadata: {},
        score: 1600 - i * 50,
        type: "trading" as const,
        numCompetitions: 5,
      }));
    };

    describe("with benchmark and trading skills", () => {
      it("should combine benchmark models with trading agents correctly", async () => {
        const benchmarkData = createMockBenchmarkData(true, false);
        const mockAgents = createMockAgents(3);

        // Mock trading stats from database
        mockRepo.getStatsForCompetitionType.mockResolvedValue({
          avgScore: 1500,
          topScore: 1600,
          totalAgents: 44,
        });

        // Mock total active agents across all types
        mockRepo.getTotalRankedAgents.mockResolvedValue(44);

        // Mock agent metrics
        mockRepo.getGlobalAgentMetricsForType.mockResolvedValueOnce({
          agents: mockAgents,
          totalCount: 44,
        });

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Verify structure
        expect(result).toHaveProperty("skills");
        expect(result).toHaveProperty("skillData");
        expect(result).toHaveProperty("globalStats");

        // Verify skills
        expect(Object.keys(result.skills)).toHaveLength(3);
        expect(result.skills.coding).toBeDefined();
        expect(result.skills.math).toBeDefined();
        expect(result.skills.crypto_trading).toBeDefined();

        // Verify coding skill (benchmark)
        expect(result.skillData.coding!.participants.models).toHaveLength(3);
        expect(result.skillData.coding!.participants.agents).toHaveLength(0);
        expect(result.skillData.coding!.stats.modelCount).toBe(3);
        expect(result.skillData.coding!.stats.agentCount).toBe(0);
        expect(result.skillData.coding!.stats.avgScore).toBe(85.47);
        expect(result.skillData.coding!.stats.topScore).toBe(88.2);

        // Verify models are sorted by rank
        const codingModels = result.skillData.coding!.participants.models;
        expect(codingModels[0]!.scores.coding?.rank).toBe(1);
        expect(codingModels[1]!.scores.coding?.rank).toBe(2);
        expect(codingModels[2]!.scores.coding?.rank).toBe(3);

        // Verify math skill (benchmark with only 2 models)
        expect(result.skillData.math!.participants.models).toHaveLength(2);
        expect(result.skillData.math!.stats.avgScore).toBe(93.7);

        // Verify trading skill (agents from database)
        expect(
          result.skillData.crypto_trading!.participants.models,
        ).toHaveLength(0);
        expect(
          result.skillData.crypto_trading!.participants.agents,
        ).toHaveLength(3);
        expect(result.skillData.crypto_trading!.stats.modelCount).toBe(0);
        expect(result.skillData.crypto_trading!.stats.agentCount).toBe(44); // From database stats
        expect(result.skillData.crypto_trading!.stats.avgScore).toBe(1500); // From database
        expect(result.skillData.crypto_trading!.stats.topScore).toBe(1600); // From database
        expect(result.skillData.crypto_trading!.stats.totalParticipants).toBe(
          44,
        );

        // Verify pagination is included for trading
        expect(result.skillData.crypto_trading!.pagination).toBeDefined();
        expect(result.skillData.crypto_trading!.pagination?.total).toBe(44);

        // Verify global stats
        expect(result.globalStats.totalSkills).toBe(3);
        expect(result.globalStats.totalModels).toBe(3);
        expect(result.globalStats.totalAgents).toBe(44);

        // Verify repository calls
        expect(mockRepo.getStatsForCompetitionType).toHaveBeenCalledWith(
          "trading",
        );
        expect(mockRepo.getStatsForCompetitionType).toHaveBeenCalledTimes(1);
        expect(mockRepo.getTotalRankedAgents).toHaveBeenCalledTimes(1);
        expect(mockRepo.getGlobalAgentMetricsForType).toHaveBeenCalledWith({
          type: "trading",
          limit: 100,
          offset: 0,
        });
      });

      it("should handle perpetual futures skill correctly", async () => {
        const benchmarkData = createMockBenchmarkData(false, true);
        const mockFuturesAgents = createMockAgents(5);

        // Mock futures stats
        mockRepo.getStatsForCompetitionType.mockResolvedValue({
          avgScore: 1450,
          topScore: 1550,
          totalAgents: 25,
        });

        // Mock total active agents (25 since only futures in this test)
        mockRepo.getTotalRankedAgents.mockResolvedValue(25);

        // Mock agent metrics for futures
        mockRepo.getGlobalAgentMetricsForType.mockResolvedValueOnce({
          agents: mockFuturesAgents,
          totalCount: 25,
        });

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Verify perpetual_futures skill
        expect(result.skillData.perpetual_futures).toBeDefined();
        expect(
          result.skillData.perpetual_futures!.participants.agents,
        ).toHaveLength(5);
        expect(result.skillData.perpetual_futures!.stats.agentCount).toBe(25);
        expect(result.skillData.perpetual_futures!.stats.avgScore).toBe(1450);
        expect(result.skillData.perpetual_futures!.stats.topScore).toBe(1550);

        // Verify repository was called correctly
        expect(mockRepo.getStatsForCompetitionType).toHaveBeenCalledWith(
          "perpetual_futures",
        );
        expect(mockRepo.getGlobalAgentMetricsForType).toHaveBeenCalledWith({
          type: "perpetual_futures",
          limit: 100,
          offset: 0,
        });
      });

      it("should handle both trading and futures skills together", async () => {
        const benchmarkData = createMockBenchmarkData(true, true);
        const mockTradingAgents = createMockAgents(3);
        const mockFuturesAgents = createMockAgents(2);

        // Mock trading stats
        mockRepo.getStatsForCompetitionType.mockResolvedValueOnce({
          avgScore: 1500,
          topScore: 1600,
          totalAgents: 44,
        });

        // Mock futures stats
        mockRepo.getStatsForCompetitionType.mockResolvedValueOnce({
          avgScore: 1450,
          topScore: 1550,
          totalAgents: 25,
        });

        // Mock total active agents across all types (69 = 44 trading + 25 futures, assuming no overlap)
        mockRepo.getTotalRankedAgents.mockResolvedValue(69);

        // Mock trading agent metrics
        mockRepo.getGlobalAgentMetricsForType.mockResolvedValueOnce({
          agents: mockTradingAgents,
          totalCount: 44,
        });

        // Mock futures agent metrics
        mockRepo.getGlobalAgentMetricsForType.mockResolvedValueOnce({
          agents: mockFuturesAgents,
          totalCount: 25,
        });

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Verify both skills exist
        expect(result.skillData.crypto_trading).toBeDefined();
        expect(result.skillData.perpetual_futures).toBeDefined();

        // Verify trading
        expect(result.skillData.crypto_trading!.stats.agentCount).toBe(44);
        expect(
          result.skillData.crypto_trading!.participants.agents,
        ).toHaveLength(3);

        // Verify futures
        expect(result.skillData.perpetual_futures!.stats.agentCount).toBe(25);
        expect(
          result.skillData.perpetual_futures!.participants.agents,
        ).toHaveLength(2);

        // Verify global stats uses combined count across all types
        expect(result.globalStats.totalAgents).toBe(69);
      });
    });

    describe("edge cases", () => {
      it("should handle empty agent responses gracefully", async () => {
        const benchmarkData = createMockBenchmarkData(true, false);

        // Mock empty agent responses
        mockRepo.getStatsForCompetitionType.mockResolvedValue({
          avgScore: 0,
          topScore: 0,
          totalAgents: 0,
        });

        mockRepo.getTotalRankedAgents.mockResolvedValue(0);

        mockRepo.getGlobalAgentMetricsForType.mockResolvedValue({
          agents: [],
          totalCount: 0,
        });

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Should still return valid structure
        expect(result.skillData.crypto_trading).toBeDefined();
        expect(
          result.skillData.crypto_trading!.participants.agents,
        ).toHaveLength(0);
        expect(result.skillData.crypto_trading!.stats.agentCount).toBe(0);
        expect(result.skillData.crypto_trading!.stats.avgScore).toBe(0);
        expect(result.skillData.crypto_trading!.stats.topScore).toBe(0);
        expect(result.globalStats.totalAgents).toBe(0);
      });

      it("should handle benchmark data with no trading skills", async () => {
        const benchmarkData = createMockBenchmarkData(false, false);

        // Mock total active agents (could still have agents even without trading skills in JSON)
        mockRepo.getTotalRankedAgents.mockResolvedValue(0);

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Should only have benchmark skills
        expect(Object.keys(result.skillData)).toHaveLength(2);
        expect(result.skillData.coding).toBeDefined();
        expect(result.skillData.math).toBeDefined();
        expect(result.skillData.crypto_trading).toBeUndefined();
        expect(result.skillData.perpetual_futures).toBeUndefined();

        // Global stats should still work
        expect(result.globalStats.totalModels).toBe(3);
        expect(result.globalStats.totalAgents).toBe(0);
      });

      it("should filter models correctly by skill", async () => {
        const benchmarkData = createMockBenchmarkData(false, false);

        mockRepo.getTotalRankedAgents.mockResolvedValue(0);

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Gemini Pro only has coding score, not math
        expect(result.skillData.coding!.participants.models).toHaveLength(3);
        expect(result.skillData.math!.participants.models).toHaveLength(2);

        // Verify correct models in math
        const mathModels = result.skillData.math!.participants.models;
        expect(mathModels.map((m) => m.id)).toEqual(
          expect.arrayContaining(["gpt-4", "claude-3"]),
        );
        expect(mathModels.map((m) => m.id)).not.toContain("gemini-pro");
      });

      it("should handle models with missing rank gracefully", async () => {
        const benchmarkData = createMockBenchmarkData(false, false);
        // Add a model with no rank (should default to 999 for sorting)
        benchmarkData.models.push({
          id: "unranked-model",
          name: "Unranked",
          provider: "Test",
          modelFamily: "Test",
          scores: {
            coding: {
              rawScore: 70.0,
              rank: 999, // Explicitly missing/high rank
              evaluatedAt: "2024-01-01T00:00:00Z",
            },
          },
        });

        mockRepo.getTotalRankedAgents.mockResolvedValue(0);

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        const codingModels = result.skillData.coding!.participants.models;
        // Unranked model should be last
        expect(codingModels[codingModels.length - 1]!.id).toBe(
          "unranked-model",
        );
      });
    });

    describe("error handling", () => {
      it("should throw error when database query fails", async () => {
        const benchmarkData = createMockBenchmarkData(true, false);

        // Mock total active agents
        mockRepo.getTotalRankedAgents.mockResolvedValue(44);

        // Mock database error
        mockRepo.getStatsForCompetitionType.mockRejectedValue(
          new Error("Database connection failed"),
        );

        await expect(
          service.getUnifiedLeaderboard(benchmarkData),
        ).rejects.toThrow("Database connection failed");

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(
          "[LeaderboardService] Failed to build unified leaderboard:",
          expect.any(Error),
        );
      });

      it("should log debug message on successful call", async () => {
        const benchmarkData = createMockBenchmarkData(false, false);

        mockRepo.getTotalRankedAgents.mockResolvedValue(0);

        await service.getUnifiedLeaderboard(benchmarkData);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "[LeaderboardService] Building unified leaderboard",
        );
      });
    });

    describe("data consistency", () => {
      it("should use stats from ALL agents, not just paginated results", async () => {
        const benchmarkData = createMockBenchmarkData(true, false);
        const mockAgents = createMockAgents(100); // Return 100 agents

        // Mock stats showing there are more agents than returned
        mockRepo.getStatsForCompetitionType.mockResolvedValue({
          avgScore: 1400, // Average of ALL agents
          topScore: 1650, // Top of ALL agents
          totalAgents: 500, // Total in database
        });

        // Mock total active agents (500 total across platform)
        mockRepo.getTotalRankedAgents.mockResolvedValue(500);

        mockRepo.getGlobalAgentMetricsForType.mockResolvedValue({
          agents: mockAgents, // Only return 100
          totalCount: 500, // But total is 500
        });

        const result = await service.getUnifiedLeaderboard(benchmarkData);

        // Verify stats are from ALL agents, not just the 100 returned
        expect(result.skillData.crypto_trading!.stats.agentCount).toBe(500);
        expect(result.skillData.crypto_trading!.stats.avgScore).toBe(1400);
        expect(result.skillData.crypto_trading!.stats.topScore).toBe(1650);
        expect(result.skillData.crypto_trading!.stats.totalParticipants).toBe(
          500,
        );

        // But participants array only has the paginated results
        expect(
          result.skillData.crypto_trading!.participants.agents,
        ).toHaveLength(100);
      });
    });
  });
});
