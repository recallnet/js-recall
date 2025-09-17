import { beforeEach, describe, expect, it, vi } from "vitest";

import * as leaderboardRepository from "@/database/repositories/leaderboard-repository.js";
import { LeaderboardParams } from "@/types/index.js";

import { LeaderboardService } from "../leaderboard.service.js";

// Mock the repository functions
vi.mock("@/database/repositories/leaderboard-repository.js", () => ({
  getGlobalStats: vi.fn(),
  getOptimizedGlobalAgentMetrics: vi.fn(),
  getTotalAgentsWithScores: vi.fn(),
}));

describe("LeaderboardService optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should pass sort and pagination params to repository", async () => {
    // Arrange
    const mockAgentService = {};
    const service = new LeaderboardService(mockAgentService as never);

    const params: LeaderboardParams = {
      type: "trading",
      sort: "-score",
      limit: 10,
      offset: 20,
    };

    // Mock repository responses
    const mockStats = {
      activeAgents: 100,
      totalCompetitions: 5,
      totalTrades: 1000,
      totalVolume: 50000,
      totalVotes: 500,
      competitionIds: ["comp1", "comp2"],
    };

    const mockAgents = [
      {
        id: "agent1",
        name: "Agent One",
        handle: "agent_one",
        description: "Test agent",
        imageUrl: null,
        metadata: {},
        score: 100,
        numCompetitions: 3,
        voteCount: 10,
      },
      {
        id: "agent2",
        name: "Agent Two",
        handle: "agent_two",
        description: "Another test agent",
        imageUrl: null,
        metadata: {},
        score: 90,
        numCompetitions: 2,
        voteCount: 8,
      },
    ];

    vi.mocked(leaderboardRepository.getGlobalStats).mockResolvedValue(
      mockStats,
    );
    vi.mocked(
      leaderboardRepository.getOptimizedGlobalAgentMetrics,
    ).mockResolvedValue(mockAgents);
    vi.mocked(leaderboardRepository.getTotalAgentsWithScores).mockResolvedValue(
      100,
    );

    // Act
    const result = await service.getGlobalLeaderboardWithSorting(params);

    // Assert
    // Verify that the repository was called with correct parameters
    expect(
      leaderboardRepository.getOptimizedGlobalAgentMetrics,
    ).toHaveBeenCalledWith("-score", 10, 20);

    // Verify that getTotalAgentsWithScores was called
    expect(leaderboardRepository.getTotalAgentsWithScores).toHaveBeenCalled();

    // Verify the response structure
    expect(result).toEqual({
      stats: {
        activeAgents: 100,
        totalCompetitions: 5,
        totalTrades: 1000,
        totalVolume: 50000,
        totalVotes: 500,
      },
      agents: expect.arrayContaining([
        expect.objectContaining({
          id: "agent1",
          name: "Agent One",
          rank: expect.any(Number),
        }),
        expect.objectContaining({
          id: "agent2",
          name: "Agent Two",
          rank: expect.any(Number),
        }),
      ]),
      pagination: {
        total: 100,
        limit: 10,
        offset: 20,
        hasMore: true,
      },
    });
  });

  it("should handle empty competition list", async () => {
    // Arrange
    const mockAgentService = {};
    const service = new LeaderboardService(mockAgentService as never);

    const params: LeaderboardParams = {
      type: "trading",
      sort: "rank",
      limit: 50,
      offset: 0,
    };

    // Mock empty stats
    const mockStats = {
      activeAgents: 0,
      totalCompetitions: 0,
      totalTrades: 0,
      totalVolume: 0,
      totalVotes: 0,
      competitionIds: [],
    };

    vi.mocked(leaderboardRepository.getGlobalStats).mockResolvedValue(
      mockStats,
    );

    // Act
    const result = await service.getGlobalLeaderboardWithSorting(params);

    // Assert
    // Should return empty response without calling getOptimizedGlobalAgentMetrics
    expect(
      leaderboardRepository.getOptimizedGlobalAgentMetrics,
    ).not.toHaveBeenCalled();

    expect(result).toEqual({
      stats: {
        activeAgents: 0,
        totalCompetitions: 0,
        totalTrades: 0,
        totalVolume: 0,
        totalVotes: 0,
      },
      agents: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      },
    });
  });

  it("should assign correct ranks for different sort fields", async () => {
    // Arrange
    const mockAgentService = {};
    const service = new LeaderboardService(mockAgentService as never);

    const params: LeaderboardParams = {
      type: "trading",
      sort: "name", // Sort by name, but ranks should still be based on score
      limit: 10,
      offset: 0,
    };

    // Mock stats
    const mockStats = {
      activeAgents: 3,
      totalCompetitions: 1,
      totalTrades: 100,
      totalVolume: 5000,
      totalVotes: 50,
      competitionIds: ["comp1"],
    };

    // Agents sorted by name already (from DB)
    const mockAgents = [
      {
        id: "agent2",
        name: "Alpha Agent",
        handle: "alpha",
        description: null,
        imageUrl: null,
        metadata: {},
        score: 50, // Lower score but first alphabetically
        numCompetitions: 1,
        voteCount: 5,
      },
      {
        id: "agent1",
        name: "Beta Agent",
        handle: "beta",
        description: null,
        imageUrl: null,
        metadata: {},
        score: 100, // Higher score but second alphabetically
        numCompetitions: 1,
        voteCount: 10,
      },
      {
        id: "agent3",
        name: "Charlie Agent",
        handle: "charlie",
        description: null,
        imageUrl: null,
        metadata: {},
        score: 75, // Middle score, last alphabetically
        numCompetitions: 1,
        voteCount: 8,
      },
    ];

    vi.mocked(leaderboardRepository.getGlobalStats).mockResolvedValue(
      mockStats,
    );
    vi.mocked(
      leaderboardRepository.getOptimizedGlobalAgentMetrics,
    ).mockResolvedValue(mockAgents);
    vi.mocked(leaderboardRepository.getTotalAgentsWithScores).mockResolvedValue(
      3,
    );

    // Act
    const result = await service.getGlobalLeaderboardWithSorting(params);

    // Assert
    // Agents should be ordered by name but have ranks based on score
    expect(result.agents).toHaveLength(3);
    expect(result.agents[0]).toMatchObject({
      name: "Alpha Agent",
      rank: 3, // Has lowest score, so rank 3
    });
    expect(result.agents[1]).toMatchObject({
      name: "Beta Agent",
      rank: 1, // Has highest score, so rank 1
    });
    expect(result.agents[2]).toMatchObject({
      name: "Charlie Agent",
      rank: 2, // Has middle score, so rank 2
    });
  });
});
