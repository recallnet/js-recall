import { beforeEach, describe, expect, test, vi } from "vitest";

import { competitions } from "@recallnet/db-schema/core/defs";
import { InsertReward } from "@recallnet/db-schema/voting/types";

import { db } from "@/database/db.js";
import { insertRewards } from "@/database/repositories/rewards-repository.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  RewardProof,
  RewardsClaimResponse,
  RewardsProofsResponse,
  RewardsTotalResponse,
} from "@/e2e/utils/api-types.js";
import {
  createSiweAuthenticatedClient,
  createTestClient,
  getAdminApiKey,
} from "@/e2e/utils/test-helpers.js";
import { RewardsService, createLeafNode } from "@/services/rewards.service.js";

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
let testUser: {
  id: string;
  walletAddress: string;
  name: string;
  email: string;
  imageUrl: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

describe("Rewards API", () => {
  // Clean up test state before each test
  let adminApiKey: string;
  let rewardsService: RewardsService;
  let testCompetitionId: string;
  let testRewards: InsertReward[];

  // Test constants for the allocate method
  const testTokenAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const testStartTimestamp = Math.floor(Date.now() / 1000); // Current timestamp

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();

    // Create RewardsService with mock RewardsAllocator
    rewardsService = new RewardsService(mockRewardsAllocator as any); // eslint-disable-line

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
    const { client, user } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: `Test User ${Date.now()}`,
      userEmail: `test-user-${Date.now()}@test.com`,
    });

    testUserAddress = user.walletAddress;
    testClient = client;
    testUser = user;

    // Create test rewards data with proper leaf hashes
    testRewards = [];

    // Create first reward for the test user
    const amount1 = BigInt(1);
    const leafHashBuffer1 = createLeafNode(
      testUserAddress as `0x${string}`,
      amount1,
    );

    testRewards.push({
      id: crypto.randomUUID(),
      competitionId: testCompetitionId,
      address: testUserAddress as `0x${string}`,
      amount: amount1,
      leafHash: new Uint8Array(leafHashBuffer1), // Convert Buffer to Uint8Array
      claimed: false,
    });

    // Create second reward for the test user
    const amount2 = BigInt(1);
    const leafHashBuffer2 = createLeafNode(
      testUserAddress as `0x${string}`,
      amount2,
    );

    testRewards.push({
      id: crypto.randomUUID(),
      competitionId: testCompetitionId,
      address: testUserAddress as `0x${string}`,
      amount: amount2,
      leafHash: new Uint8Array(leafHashBuffer2), // Convert Buffer to Uint8Array
      claimed: false,
    });

    // Insert test rewards into database
    await insertRewards(testRewards);

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

    // Test POST /user/rewards/claim without authentication
    const claimResponse = await client.claimAllRewards();
    expect(claimResponse.success).toBe(false);
  });

  test("authenticated user can get total claimable rewards", async () => {
    // Verify testClient and testUser are properly initialized
    expect(testClient).toBeDefined();
    expect(testUser).toBeDefined();
    expect(testUser.walletAddress).toBeDefined();

    // Get total claimable rewards using the test client
    const response = await testClient.getTotalClaimableRewards();

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.address.toLowerCase()).toBe(
        testUser.walletAddress.toLowerCase(),
      );
      expect(response.totalClaimableRewards).toBeDefined();
      expect(typeof response.totalClaimableRewards).toBe("string");
      // The rewards have amounts 1 and 1, so total should be "2"
      expect(response.totalClaimableRewards).toBe("2");
    }
  });

  test("authenticated user can get rewards with proofs", async () => {
    // Get rewards with proofs using the test client
    const response = await testClient.getRewardsWithProofs();

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.address.toLowerCase()).toBe(
        testUser.walletAddress.toLowerCase(),
      );
      expect(Array.isArray(response.rewards)).toBe(true);
      expect(response.rewards.length).toBe(2); // Should have exactly two rewards

      // Validate the reward structure for both rewards
      response.rewards.forEach((reward: RewardProof) => {
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
    }
  });

  test("authenticated user can claim all rewards", async () => {
    // Claim all rewards using the test client
    const response = await testClient.claimAllRewards();

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.address.toLowerCase()).toBe(
        testUser.walletAddress.toLowerCase(),
      );
      expect(typeof response.claimedCount).toBe("number");
      expect(response.claimedCount).toBe(2); // Should claim exactly 2 rewards
    }
  });

  test("claiming rewards updates the total claimable amount", async () => {
    // Get initial total claimable rewards using the test client
    const initialResponse = await testClient.getTotalClaimableRewards();
    expect(initialResponse.success).toBe(true);

    const initialTotal = BigInt(
      (initialResponse as RewardsTotalResponse).totalClaimableRewards,
    );
    expect(initialTotal).toBe(BigInt(2)); // Should start with 2 rewards

    // Claim all rewards using the test client
    const claimResponse = await testClient.claimAllRewards();
    expect(claimResponse.success).toBe(true);

    const claimedCount = (claimResponse as RewardsClaimResponse).claimedCount;
    expect(claimedCount).toBe(2); // Should claim exactly 2 rewards

    // Get total after claiming using the test client
    const afterResponse = await testClient.getTotalClaimableRewards();
    expect(afterResponse.success).toBe(true);

    const afterTotal = BigInt(
      (afterResponse as RewardsTotalResponse).totalClaimableRewards,
    );

    // After claiming, total should be 0
    expect(afterTotal).toBe(BigInt(0));
  });

  test("claiming rewards updates the proofs response", async () => {
    // Get initial rewards with proofs using the test client
    const initialResponse = await testClient.getRewardsWithProofs();
    expect(initialResponse.success).toBe(true);

    const initialRewardsCount = (initialResponse as RewardsProofsResponse)
      .rewards.length;
    expect(initialRewardsCount).toBe(2); // Should start with 2 rewards

    // Claim all rewards using the test client
    const claimResponse = await testClient.claimAllRewards();
    expect(claimResponse.success).toBe(true);

    const claimedCount = (claimResponse as RewardsClaimResponse).claimedCount;
    expect(claimedCount).toBe(2); // Should claim exactly 2 rewards

    // Get rewards after claiming using the test client
    const afterResponse = await testClient.getRewardsWithProofs();
    expect(afterResponse.success).toBe(true);
    const afterRewardsCount = (afterResponse as RewardsProofsResponse).rewards
      .length;

    // After claiming, proofs should be empty
    expect(afterRewardsCount).toBe(0);
  });

  test("multiple claims return zero claimed count", async () => {
    // First claim using the test client
    const firstClaim = await testClient.claimAllRewards();
    expect(firstClaim.success).toBe(true);

    const firstClaimedCount = (firstClaim as RewardsClaimResponse).claimedCount;
    expect(firstClaimedCount).toBe(2); // Should claim exactly 2 rewards

    // Second claim should return 0 since first claim was successful
    const secondClaim = await testClient.claimAllRewards();
    expect(firstClaim.success).toBe(true);

    const secondClaimedCount = (secondClaim as RewardsClaimResponse)
      .claimedCount;
    expect(secondClaimedCount).toBe(0); // Should claim 0 rewards on second attempt
  });
});
