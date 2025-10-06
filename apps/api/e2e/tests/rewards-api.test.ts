import { hexToBytes } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { competitions } from "@recallnet/db/schema/core/defs";
import { InsertReward } from "@recallnet/db/schema/voting/types";
import { RewardsService, createLeafNode } from "@recallnet/services";

import { db } from "@/database/db.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  RewardProof,
  RewardsProofsResponse,
  RewardsTotalResponse,
} from "@/e2e/utils/api-types.js";
import {
  createPrivyAuthenticatedClient,
  createTestClient,
} from "@/e2e/utils/test-helpers.js";
import { logger } from "@/lib/logger.js";

import { TestPrivyUser } from "../utils/privy.js";

// Mock the RewardsAllocator class
const mockRewardsAllocator = {
  allocate: vi.fn().mockResolvedValue({
    transactionHash:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    blockNumber: BigInt(12345),
    gasUsed: BigInt(100000),
  }),
};

let testUserAddress: string;
let testClient: ApiClient;

describe("Rewards API", () => {
  // Clean up test state before each test
  let rewardsService: RewardsService;
  let testCompetitionId: string;
  let testRewards: InsertReward[];
  let testUser: TestPrivyUser;

  // Test constants for the allocate method
  const testTokenAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const testStartTimestamp = Math.floor(Date.now() / 1000); // Current timestamp

  beforeEach(async () => {
    const rewardsRepository = new RewardsRepository(db, logger);
    // Create RewardsService with mock RewardsAllocator
    rewardsService = new RewardsService(
      rewardsRepository,
      new CompetitionRepository(db, db, logger),
      new BoostRepository(db),
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

    // Create a SIWE-authenticated client to get a test user address
    const { client, user } = await createPrivyAuthenticatedClient({
      userName: `Test User ${Date.now()}`,
      userEmail: `test-user-${Date.now()}@test.com`,
    });

    testUserAddress = user.walletAddress;
    testClient = client;
    testUser = user as unknown as TestPrivyUser;

    // Create test rewards data with proper leaf hashes
    testRewards = [];

    // Create first reward for the test user
    const amount1 = BigInt(1);
    const leafHashHex1 = createLeafNode(
      testUserAddress as `0x${string}`,
      amount1,
    );

    testRewards.push({
      id: crypto.randomUUID(),
      competitionId: testCompetitionId,
      address: testUserAddress as `0x${string}`,
      amount: amount1,
      leafHash: hexToBytes(leafHashHex1),
      claimed: false,
    });

    // Create second reward for the test user
    const amount2 = BigInt(1);
    const leafHashHex2 = createLeafNode(
      testUserAddress as `0x${string}`,
      amount2,
    );

    testRewards.push({
      id: crypto.randomUUID(),
      competitionId: testCompetitionId,
      address: testUserAddress as `0x${string}`,
      amount: amount2,
      leafHash: hexToBytes(leafHashHex2),
      claimed: false,
    });

    // Insert test rewards into database
    await rewardsRepository.insertRewards(testRewards);

    // Execute the allocate method with all required parameters
    await rewardsService.allocate(
      testCompetitionId,
      testTokenAddress,
      testStartTimestamp,
    );
  });

  test("unauthenticated user cannot access rewards endpoints", async () => {
    const client = createTestClient();

    // Test GET /user/rewards/total without authentication
    const totalResponse = await client.getTotalClaimableRewards();
    expect(totalResponse.success).toBe(false);

    // Test GET /user/rewards/proofs without authentication
    const proofsResponse = await client.getRewardsWithProofs();
    expect(proofsResponse.success).toBe(false);
  });

  test("authenticated user can get total claimable rewards", async () => {
    // Verify testClient and testUser are properly initialized
    expect(testClient).toBeDefined();
    expect(testUser).toBeDefined();
    expect(testUser.walletAddress).toBeDefined();

    // Get total claimable rewards using the test client
    const response = await testClient.getTotalClaimableRewards();

    expect(response.success).toBe(true);
    const responseData = response as RewardsTotalResponse;
    expect(responseData.address.toLowerCase()).toBe(
      testUser.walletAddress?.toLowerCase(),
    );
    expect(responseData.totalClaimableRewards).toBeDefined();
    expect(typeof responseData.totalClaimableRewards).toBe("string");
    // The rewards have amounts 1 and 1, so total should be "2"
    expect(responseData.totalClaimableRewards).toBe("2");
  });

  test("authenticated user can get rewards with proofs", async () => {
    // Get rewards with proofs using the test client
    const response = await testClient.getRewardsWithProofs();

    expect(response.success).toBe(true);
    const responseData = response as RewardsProofsResponse;
    expect(responseData.address.toLowerCase()).toBe(
      testUser.walletAddress?.toLowerCase(),
    );
    expect(Array.isArray(responseData.rewards)).toBe(true);
    expect(responseData.rewards.length).toBe(2); // Should have exactly two rewards

    // Validate the reward structure for both rewards
    responseData.rewards.forEach((reward: RewardProof) => {
      expect(reward.merkleRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(typeof reward.amount).toBe("string");
      expect(reward.amount).toBe("1"); // Each reward has amount 1
      expect(Array.isArray(reward.proof)).toBe(true);
      expect(reward.proof.length).toBe(2); // With 2 rewards, each proof has 1 sibling

      // Validate proof format (should be hex strings)
      reward.proof.forEach((proofItem: string) => {
        expect(proofItem).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });
  });
});
