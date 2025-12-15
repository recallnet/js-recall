import { hexToBytes } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { competitions } from "@recallnet/db/schema/core/defs";
import { InsertReward } from "@recallnet/db/schema/rewards/types";
import { RewardsService, createLeafNode } from "@recallnet/services";

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";
import { createPrivyAuthenticatedRpcClient } from "../utils/test-helpers.js";

const logger = createLogger("RewardsApiTest");

// Mock the RewardsAllocator class
const createMockRewardsAllocator = (transactionHash: string | null) => ({
  allocate: vi.fn().mockResolvedValue({
    transactionHash,
    blockNumber: transactionHash ? BigInt(12345) : null,
    gasUsed: transactionHash ? BigInt(100000) : null,
  }),
});

describe("Rewards API", () => {
  // Clean up test state before each test
  let rewardsService: RewardsService;
  let testCompetitionId: string;
  let testRewards: InsertReward[];
  let testUserAddress: string;
  let testUserId: string;
  let testRpcClient: Awaited<ReturnType<typeof createTestRpcClient>>;
  let mockRewardsAllocator: ReturnType<typeof createMockRewardsAllocator>;

  // Test constants for the allocate method
  const testStartTimestamp = Math.floor(Date.now() / 1000); // Current timestamp

  beforeEach(async () => {
    const rewardsRepository = new RewardsRepository(db, logger);
    const agentRepository = new AgentRepository(
      db,
      logger,
      new CompetitionRewardsRepository(db, logger),
    );
    // Create mock allocator with valid transaction hash by default
    mockRewardsAllocator = createMockRewardsAllocator(
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    );
    // Create RewardsService with mock RewardsAllocator
    rewardsService = new RewardsService(
      rewardsRepository,
      new CompetitionRepository(db, db, logger),
      new BoostRepository(db),
      agentRepository,
      mockRewardsAllocator as any, // eslint-disable-line
      db,
      logger,
    );

    // Create a test competition with UUID
    const competitionId = "756fddf2-d5a3-4d07-b769-109583469c88";
    const [competition] = await db
      .insert(competitions)
      .values({
        id: competitionId,
        name: "Test Competition",
        description: "A test competition for rewards",
        status: "active",
        type: "trading",
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      })
      .returning();

    expect(!competition).toBe(false);
    testCompetitionId = competitionId;

    // Create a Privy-authenticated RPC client
    const { user, rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: `Test User ${Date.now()}`,
      userEmail: `test-user-${Date.now()}@test.com`,
    });

    testUserAddress = user.walletAddress || user.embeddedWalletAddress;
    testUserId = user.id;
    testRpcClient = rpcClient;

    // Create test rewards data with proper leaf hashes
    testRewards = [];

    // Create a single reward for the test user with amount 2
    const totalAmount = BigInt(2);
    const leafHashHex = createLeafNode(
      testUserAddress as `0x${string}`,
      totalAmount,
    );

    testRewards.push({
      id: crypto.randomUUID(),
      competitionId: testCompetitionId,
      userId: testUserId,
      walletAddress: testUserAddress,
      amount: totalAmount,
      leafHash: hexToBytes(leafHashHex),
      claimed: false,
    });

    // Insert test rewards into database
    await rewardsRepository.insertRewards(testRewards);

    // Execute the allocate method with all required parameters
    await rewardsService.allocate(testCompetitionId, testStartTimestamp);
  });

  test("unauthenticated user cannot access rewards endpoints", async () => {
    // Create RPC client without authentication
    const unauthRpcClient = await createTestRpcClient();

    // Test rewards.getClaimData without authentication (should throw)
    await expect(unauthRpcClient.rewards.getClaimData()).rejects.toThrow(
      /Unauthorized/,
    );
  });

  test("authenticated user can get rewards with proofs", async () => {
    // Get rewards with proofs using the RPC client
    const rewards = await testRpcClient.rewards.getClaimData();

    expect(Array.isArray(rewards)).toBe(true);
    expect(rewards.length).toBe(1); // Should have exactly one reward

    // Validate the reward structure
    rewards.forEach((reward) => {
      expect(reward.merkleRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(typeof reward.amount).toBe("string");
      expect(reward.amount).toBe("2"); // Single reward has amount 2
      expect(Array.isArray(reward.proof)).toBe(true);
      expect(reward.proof.length).toBe(1); // With 1 reward + faux leaf, proof has 1 element

      // Validate proof format (should be hex strings)
      reward.proof.forEach((proofItem: string) => {
        expect(proofItem).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });
  });

  test("getRewardsWithProofs returns empty when allocator returns null transaction hash", async () => {
    // Create a new competition for this test
    const competitionId = "876fddf2-d5a3-4d07-b769-109583469c99";
    const [competition] = await db
      .insert(competitions)
      .values({
        id: competitionId,
        name: "Test Competition Null TX",
        description: "A test competition for null transaction hash",
        status: "active",
        type: "trading",
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      })
      .returning();

    expect(!competition).toBe(false);

    // Create a Privy-authenticated RPC client
    const { user, rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: `Test User Null TX ${Date.now()}`,
      userEmail: `test-user-null-tx-${Date.now()}@test.com`,
    });

    const userAddress = user.walletAddress;

    // Create rewards repository and service with null-returning allocator
    const rewardsRepository = new RewardsRepository(db, logger);
    const agentRepository = new AgentRepository(
      db,
      logger,
      new CompetitionRewardsRepository(db, logger),
    );
    const nullAllocator = createMockRewardsAllocator(null);
    const serviceWithNullAllocator = new RewardsService(
      rewardsRepository,
      new CompetitionRepository(db, db, logger),
      new BoostRepository(db),
      agentRepository,
      nullAllocator as any, // eslint-disable-line
      db,
      logger,
    );

    // Create test rewards data
    const totalAmount = BigInt(5);
    const leafHashHex = createLeafNode(
      userAddress as `0x${string}`,
      totalAmount,
    );

    const rewardsData: InsertReward[] = [
      {
        id: crypto.randomUUID(),
        competitionId: competitionId,
        userId: user.id,
        walletAddress: userAddress,
        amount: totalAmount,
        leafHash: hexToBytes(leafHashHex),
        claimed: false,
      },
    ];

    // Insert test rewards into database
    await rewardsRepository.insertRewards(rewardsData);

    // Execute the allocate method with null-returning allocator
    await serviceWithNullAllocator.allocate(competitionId, testStartTimestamp);

    // Verify that allocate was called
    expect(nullAllocator.allocate).toHaveBeenCalled();

    // Verify that getClaimData returns empty array even though rewards were added
    const rewards = await rpcClient.rewards.getClaimData();
    expect(Array.isArray(rewards)).toBe(true);
    expect(rewards.length).toBe(0); // Should be empty because tx is null
  });
});
