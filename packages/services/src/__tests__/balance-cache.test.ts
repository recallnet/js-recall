// ABOUTME: Tests for BalanceService cache invalidation functionality
// ABOUTME: Ensures proper clearing of balance cache when competitions end
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BalanceRepository } from "@recallnet/db/repositories/balance";

import { BalanceService, BalanceServiceConfig } from "../balance.service.js";

// Create a mock class that implements BalanceRepository
class MockBalanceRepository {
  getBalance = vi.fn();
  getAgentBalances = vi.fn();
  getAgentsBulkBalances = vi.fn();
  resetAgentBalances = vi.fn();
  count = vi.fn();
}

vi.mock("@recallnet/db/repositories/balance", () => ({
  BalanceRepository: vi
    .fn()
    .mockImplementation(() => new MockBalanceRepository()),
}));

// Mock config
const mockConfig: BalanceServiceConfig = {
  specificChainBalances: {
    eth: {
      USDC: 5000,
    },
    base: {
      USDC: 5000,
    },
  },
  specificChainTokens: {
    eth: {
      USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    base: {
      USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    },
    polygon: {},
    svm: {},
    optimism: {},
    arbitrum: {},
  },
};

describe("BalanceService - Cache Invalidation", () => {
  let service: BalanceService;
  let mockRepo: BalanceRepository;
  let mockRepoInstance: MockBalanceRepository;
  let mockLogger: MockProxy<Logger>;

  const agent1Id = "agent-1";
  const agent2Id = "agent-2";
  const agent3Id = "agent-3";
  const comp1Id = "comp-1";
  const comp2Id = "comp-2";
  const tokenAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

  beforeEach(() => {
    mockRepoInstance = new MockBalanceRepository();
    mockRepo = mockRepoInstance as unknown as BalanceRepository;
    mockLogger = mock<Logger>();
    service = new BalanceService(mockRepo, mockConfig, mockLogger);
    vi.clearAllMocks();
  });

  describe("clearCompetitionCache", () => {
    it("should clear cache for all agents in a specific competition", async () => {
      // Setup: Populate cache with balances for multiple agents and competitions
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1000,
      });

      // Get balances to populate cache
      await service.getBalance(agent1Id, tokenAddress, comp1Id);
      await service.getBalance(agent1Id, tokenAddress, comp2Id);
      await service.getBalance(agent2Id, tokenAddress, comp1Id);
      await service.getBalance(agent2Id, tokenAddress, comp2Id);
      await service.getBalance(agent3Id, tokenAddress, comp1Id);

      // Clear cache for comp1
      service.clearCompetitionCache(comp1Id);

      // Verify: Subsequent getBalance calls for comp1 should hit the database again
      mockRepoInstance.getBalance.mockClear();
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 2000,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);
      await service.getBalance(agent2Id, tokenAddress, comp1Id);
      await service.getBalance(agent3Id, tokenAddress, comp1Id);

      // Should have called DB 3 times for comp1 (cache was cleared)
      expect(mockRepoInstance.getBalance).toHaveBeenCalledTimes(3);

      // But comp2 should still use cache
      mockRepoInstance.getBalance.mockClear();
      await service.getBalance(agent1Id, tokenAddress, comp2Id);
      await service.getBalance(agent2Id, tokenAddress, comp2Id);

      // Should not call DB (cache still valid)
      expect(mockRepoInstance.getBalance).not.toHaveBeenCalled();
    });

    it("should handle clearing cache for competition with no cached data", () => {
      // Should not throw when clearing cache for a competition that has no entries
      expect(() =>
        service.clearCompetitionCache("non-existent-comp"),
      ).not.toThrow();
    });

    it("should remove agent entries that have no remaining competitions cached", async () => {
      // Setup: Single agent with single competition
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1000,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);

      // Clear the only competition this agent has cached
      service.clearCompetitionCache(comp1Id);

      // Verify: After clearing, the agent should be completely removed from cache
      mockRepoInstance.getBalance.mockClear();
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1500,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);

      // Should hit DB because agent was removed from cache
      expect(mockRepoInstance.getBalance).toHaveBeenCalledTimes(1);
    });

    it("should preserve agent entries that have other competitions cached", async () => {
      // Setup: Single agent with multiple competitions
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1000,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);
      await service.getBalance(agent1Id, tokenAddress, comp2Id);

      // Clear only one competition
      service.clearCompetitionCache(comp1Id);

      // Verify: comp2 should still be cached
      mockRepoInstance.getBalance.mockClear();
      await service.getBalance(agent1Id, tokenAddress, comp2Id);

      // Should not hit DB (comp2 still cached)
      expect(mockRepoInstance.getBalance).not.toHaveBeenCalled();
    });

    it("should clear cache for multiple tokens in the same competition", async () => {
      const token1 = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      const token2 = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress: token1,
        amount: 1000,
      });

      // Populate cache with multiple tokens
      await service.getBalance(agent1Id, token1, comp1Id);
      await service.getBalance(agent1Id, token2, comp1Id);

      // Clear cache for competition
      service.clearCompetitionCache(comp1Id);

      // Verify: All tokens for this competition should be cleared
      mockRepoInstance.getBalance.mockClear();
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress: token1,
        amount: 2000,
      });

      await service.getBalance(agent1Id, token1, comp1Id);
      await service.getBalance(agent1Id, token2, comp1Id);

      // Both should hit DB (both cleared)
      expect(mockRepoInstance.getBalance).toHaveBeenCalledTimes(2);
    });

    it("should not affect other competitions when clearing specific competition", async () => {
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1000,
      });

      // Setup cache for multiple competitions
      await service.getBalance(agent1Id, tokenAddress, comp1Id);
      await service.getBalance(agent2Id, tokenAddress, comp1Id);
      await service.getBalance(agent1Id, tokenAddress, comp2Id);
      await service.getBalance(agent2Id, tokenAddress, comp2Id);

      // Clear only comp1
      service.clearCompetitionCache(comp1Id);

      // Verify comp2 is still cached
      mockRepoInstance.getBalance.mockClear();
      await service.getBalance(agent1Id, tokenAddress, comp2Id);
      await service.getBalance(agent2Id, tokenAddress, comp2Id);

      // Should not hit DB for comp2
      expect(mockRepoInstance.getBalance).not.toHaveBeenCalled();

      // But comp1 should hit DB
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1500,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);
      await service.getBalance(agent2Id, tokenAddress, comp1Id);

      // Should hit DB for comp1
      expect(mockRepoInstance.getBalance).toHaveBeenCalledTimes(2);
    });

    it("should work correctly after multiple clear operations", async () => {
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 1000,
      });

      // Populate cache
      await service.getBalance(agent1Id, tokenAddress, comp1Id);

      // Clear multiple times
      service.clearCompetitionCache(comp1Id);
      service.clearCompetitionCache(comp1Id);
      service.clearCompetitionCache(comp1Id);

      // Verify still works correctly after multiple clears
      mockRepoInstance.getBalance.mockClear();
      mockRepoInstance.getBalance.mockResolvedValue({
        agentId: agent1Id,
        competitionId: comp1Id,
        tokenAddress,
        amount: 2000,
      });

      await service.getBalance(agent1Id, tokenAddress, comp1Id);

      // Should hit DB once
      expect(mockRepoInstance.getBalance).toHaveBeenCalledTimes(1);
    });
  });
});
