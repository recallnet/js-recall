import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { UserRepository } from "@recallnet/db/repositories/user";
import type { SelectAgent } from "@recallnet/db/schema/core/types";
import { SelectCompetition } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import { RewardsService } from "../rewards.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";
import {
  ApiError,
  type SpecificChain,
  type SpecificChainBalances,
} from "../types/index.js";

describe("CompetitionService - joinCompetition", () => {
  let competitionService: CompetitionService;
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let rewardsService: MockProxy<RewardsService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockCompetitionId = randomUUID();
  const mockUserId = randomUUID();
  const mockAgent: SelectAgent = {
    id: randomUUID(),
    ownerId: mockUserId,
    walletAddress: "0x1234567890123456789012345678901234567890",
    name: "Test Agent",
    handle: "test-agent",
    email: null,
    description: null,
    imageUrl: null,
    apiKey: "test-api-key",
    apiKeyHash: "test-hash",
    metadata: null,
    status: "active",
    deactivationReason: null,
    deactivationDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock competition with all required fields for trading competitions
  const mockCompetition: SelectCompetition & {
    crossChainTradingType: "allow";
  } = {
    id: mockCompetitionId,
    name: "Test Competition",
    description: "Test Description",
    type: "trading",
    status: "pending",
    startDate: new Date(),
    endDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    imageUrl: null,
    externalUrl: null,
    boostStartDate: null,
    boostEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    sandboxMode: false,
    minimumStake: null,
    vips: null,
    allowlist: null,
    blocklist: null,
    minRecallRank: null,
    allowlistOnly: false,
    agentAllocation: null,
    agentAllocationUnit: null,
    boosterAllocation: null,
    boosterAllocationUnit: null,
    rewardRules: null,
    rewardDetails: null,
    crossChainTradingType: "allow",
    displayState: null,
    arenaId: "default-paper-arena",
    engineId: "spot_paper_trading" as const,
    engineVersion: "1.0.0",
    rewardsIneligible: null,
  };

  beforeEach(() => {
    // Create mocks
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    rewardsService = mock<RewardsService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    stakesRepo = mock<StakesRepository>();
    userRepo = mock<UserRepository>();
    mockDb = mock<Database>();
    logger = mock<Logger>();

    // Mock config
    const mockConfig = {
      evmChains: [
        "eth",
        "polygon",
        "bsc",
        "arbitrum",
        "base",
        "optimism",
      ] as SpecificChain[],
      specificChainBalances: {
        eth: { eth: 1 },
      } as SpecificChainBalances,
      maxTradePercentage: 1,
      rateLimiting: {
        maxRequests: 100,
        windowMs: 60000,
      },
    };

    // Create service instance
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      agentService,
      agentRankService,
      tradingConstraintsService,
      competitionRewardService,
      rewardsService,
      perpsDataProcessor,
      agentRepo,
      agentScoreRepo,
      perpsRepo,
      competitionRepo,
      stakesRepo,
      userRepo,
      mockDb,
      mockConfig,
      logger,
    );
  });

  describe("one agent per user limit", () => {
    it("should allow user to register their first agent successfully", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Verify
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });

    it("should reject when user already has another agent registered (user auth)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(
        "You already have an agent registered in this competition",
      );
    });

    it("should reject when user already has another agent registered (agent auth)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify (using agent API key auth)
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          undefined,
          mockAgent.id,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          undefined,
          mockAgent.id,
        ),
      ).rejects.toThrow(
        "You already have an agent registered in this competition",
      );
    });

    it("should return correct HTTP status code (409)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify
      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
      }
    });

    it("should check for participant limit errors", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("Competition has reached maximum participant limit (10)"),
      );

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("maximum participant limit");

      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
      }
    });

    it("should not call addAgentToCompetition if agent is already active", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(true);

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("already actively registered");

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should reject if competition is not in pending status", async () => {
      // Setup mocks
      const activeCompetition = {
        ...mockCompetition,
        status: "active" as const,
      };
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(activeCompetition);

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("Cannot join competition that has already started");

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should allow re-adding same agent (idempotent)", async () => {
      // Setup mocks for first registration
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // First registration
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Setup mocks for second registration (same agent)
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(true);

      // Second registration should be rejected by the "already active" check
      // (which happens before addAgentToCompetition is called)
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("already actively registered");

      // Verify addAgentToCompetition was called only once
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledTimes(1);
    });

    it("should handle race condition when two agents register simultaneously", async () => {
      // Simulate race condition: first call succeeds, second call fails
      // because the transaction detects the user already has an agent
      const agent2Id = randomUUID();
      const agent2: SelectAgent = {
        ...mockAgent,
        id: agent2Id,
        name: "Test Agent 2",
        handle: "test-agent-2",
      };

      // First registration attempt
      agentService.getAgent.mockResolvedValueOnce(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValueOnce(false);
      competitionRepo.addAgentToCompetition.mockResolvedValueOnce();

      // Second registration attempt (simulating race condition)
      agentService.getAgent.mockResolvedValueOnce(agent2);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValueOnce(false);
      competitionRepo.addAgentToCompetition.mockRejectedValueOnce(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute both registrations
      const [result1, result2] = await Promise.allSettled([
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
        competitionService.joinCompetition(
          mockCompetition.id,
          agent2Id,
          mockUserId,
          undefined,
        ),
      ]);

      // First should succeed
      expect(result1.status).toBe("fulfilled");

      // Second should fail with correct error
      expect(result2.status).toBe("rejected");
      if (result2.status === "rejected") {
        expect(result2.reason).toBeInstanceOf(ApiError);
        expect((result2.reason as ApiError).statusCode).toBe(409);
        expect((result2.reason as ApiError).message).toContain(
          "already have an agent registered in this competition",
        );
      }

      // Both should have attempted to call addAgentToCompetition
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledTimes(2);
    });
  });

  describe("minimum stake validation", () => {
    const mockUser = {
      id: mockUserId,
      name: "Test User",
      walletAddress: "0x1234567890123456789012345678901234567890",
      walletLastVerifiedAt: new Date(),
      embeddedWalletAddress: null,
      privyId: "test-privy-id",
      email: "test@example.com",
      isSubscribed: false,
      imageUrl: null,
      metadata: null,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    it("should allow join when user has sufficient stake", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(mockUser);
      stakesRepo.getTotalStakedByWallet.mockResolvedValue(
        BigInt("2000000000000000000000"),
      ); // 2000 tokens (sufficient)
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Verify
      expect(userRepo.findById).toHaveBeenCalledWith(mockUserId);
      expect(stakesRepo.getTotalStakedByWallet).toHaveBeenCalledWith(
        mockUser.walletAddress,
      );
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });

    it("should reject when user has insufficient stake", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(mockUser);
      stakesRepo.getTotalStakedByWallet.mockResolvedValue(
        BigInt("500000000000000000000"),
      ); // 500 tokens (insufficient)

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(
        "minimum stake requirement (1,000) to join this competition is not met",
      );

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should return correct HTTP status code (403) for insufficient stake", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(mockUser);
      stakesRepo.getTotalStakedByWallet.mockResolvedValue(
        BigInt("500000000000000000000"),
      ); // 500 tokens (insufficient)

      // Execute & Verify
      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      }
    });

    it("should allow join when competition has no minimum stake requirement", async () => {
      // Setup mocks - competition with no minimum stake
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition); // no minimumStake field
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Verify
      expect(userRepo.findById).not.toHaveBeenCalled();
      expect(stakesRepo.getTotalStakedByWallet).not.toHaveBeenCalled();
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });

    it("should allow join when minimum stake is 0", async () => {
      // Setup mocks
      const competitionWithZeroStake = {
        ...mockCompetition,
        minimumStake: 0,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithZeroStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Verify
      expect(userRepo.findById).not.toHaveBeenCalled();
      expect(stakesRepo.getTotalStakedByWallet).not.toHaveBeenCalled();
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });

    it("should handle user not found during stake validation", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(undefined); // User not found

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(`User not found: ${mockUserId}`);

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should return correct HTTP status code (404) for user not found", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(undefined); // User not found

      // Execute & Verify
      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      }
    });

    it("should work with agent API key authentication", async () => {
      // Setup mocks
      const competitionWithStake = {
        ...mockCompetition,
        minimumStake: 1000,
      };

      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(competitionWithStake);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      userRepo.findById.mockResolvedValue(mockUser);
      stakesRepo.getTotalStakedByWallet.mockResolvedValue(
        BigInt("2000000000000000000000"),
      ); // 2000 tokens (sufficient)
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute with agent API key authentication
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        undefined, // no userId
        mockAgent.id, // authenticatedAgentId
      );

      // Verify
      expect(userRepo.findById).toHaveBeenCalledWith(mockAgent.ownerId);
      expect(stakesRepo.getTotalStakedByWallet).toHaveBeenCalledWith(
        mockUser.walletAddress,
      );
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });
  });
});
