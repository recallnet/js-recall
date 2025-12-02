import { eq } from "drizzle-orm";
import { MerkleTree } from "merkletreejs";
import { hexToBytes, keccak256 } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { competitions, users } from "@recallnet/db/schema/core/defs";
import {
  rewards,
  rewardsRoots,
  rewardsTree,
} from "@recallnet/db/schema/rewards/defs";
import { InsertReward } from "@recallnet/db/schema/rewards/types";
import {
  RewardsService,
  createFauxLeafNode,
  createLeafNode,
} from "@recallnet/services";

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("RewardsTest");

// Mock the RewardsAllocator class
const mockRewardsAllocator = {
  allocate: vi.fn().mockResolvedValue({
    transactionHash:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    blockNumber: BigInt(12345),
    gasUsed: BigInt(100000),
  }),
};

describe("Rewards Service", () => {
  let rewardsRepo: RewardsRepository;
  let competitionRepo: CompetitionRepository;
  let boostRepo: BoostRepository;
  let rewardsService: RewardsService;
  let testCompetitionId: string;
  let testUserId: string;

  // Test constants for the allocate method
  const testStartTimestamp = Math.floor(Date.now() / 1000); // Current timestamp

  beforeEach(async () => {
    // Create repository instances
    rewardsRepo = new RewardsRepository(db, logger);
    competitionRepo = new CompetitionRepository(db, db, logger);
    boostRepo = new BoostRepository(db);
    const agentRepo = new AgentRepository(
      db,
      logger,
      new CompetitionRewardsRepository(db, logger),
    );

    // Create RewardsService with all required dependencies
    rewardsService = new RewardsService(
      rewardsRepo,
      competitionRepo,
      boostRepo,
      agentRepo,
      mockRewardsAllocator as any, // eslint-disable-line
      db,
      logger,
    );

    // Create a test user
    const userId = "12345678-1234-1234-1234-123456789012";
    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        walletAddress: "0x1234567890123456789012345678901234567890",
        email: "test@example.com",
      })
      .returning();

    expect(!user).toBe(false);
    testUserId = userId;

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
  });

  test("allocate method creates merkle tree and stores root hash", async () => {
    // Prepare test rewards data with proper leaf hashes
    const testRewards: InsertReward[] = [];

    // Create three rewards with deterministic addresses
    const addresses = [
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
      "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
    ];
    for (let i = 0; i < 3; i++) {
      const address = addresses[i] as `0x${string}`;
      const amount = BigInt(i + 1);

      // Generate proper leaf hash using the standalone function
      const leafHashBuffer = createLeafNode(address, amount);

      testRewards.push({
        id: crypto.randomUUID(),
        competitionId: testCompetitionId,
        userId: testUserId,
        address,
        amount,
        leafHash: hexToBytes(leafHashBuffer), // Convert Buffer to Uint8Array
        claimed: false,
      });
    }

    // Insert test rewards into database
    await rewardsRepo.insertRewards(testRewards);

    // Execute the allocate method with all required parameters
    await rewardsService.allocate(testCompetitionId, testStartTimestamp);

    // Verify that merkle tree nodes were created
    const treeNodes = await db
      .select()
      .from(rewardsTree)
      .where(eq(rewardsTree.competitionId, testCompetitionId));

    expect(treeNodes.length).toBe(7);

    // Verify that different levels exist (leaf level 0 and at least one parent level)
    const levels = [...new Set(treeNodes.map((node) => node.level))].sort();
    expect(levels).toStrictEqual([0, 1, 2]); // Should have levels 0, 1, 2

    // Verify that root hash was stored
    const rootEntries = await db
      .select()
      .from(rewardsRoots)
      .where(eq(rewardsRoots.competitionId, testCompetitionId));

    expect(rootEntries.length).toBe(1);
    expect(Buffer.from(rootEntries[0]!.rootHash).toString("hex")).toBe(
      "dff434aaf652bbb60e68c978041653e565ff2ee478d62fe2e1ff42ae3e6b6177",
    );
    expect(rootEntries[0]?.rootHash.length).toBe(32); // Should have 32 bytes
    expect(rootEntries[0]?.competitionId).toBe(testCompetitionId);

    // Verify that leaf nodes match the number of rewards
    const leafNodes = treeNodes.filter((node) => node.level === 0);
    expect(leafNodes.length).toBe(testRewards.length + 1); // Should have +1 because of faux leaf

    // Verify root level has exactly one node
    const rootLevel = Math.max(...levels);
    const rootNodes = treeNodes.filter((node) => node.level === rootLevel);
    expect(rootNodes.length).toBe(1);

    // Verify that the mock RewardsAllocator was called
    expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
      "0xdff434aaf652bbb60e68c978041653e565ff2ee478d62fe2e1ff42ae3e6b6177", // root hash
      6n,
      testStartTimestamp,
    );
  });

  test("allocate method throws error when no rewards exist for competition", async () => {
    // Try to allocate rewards for a competition with no rewards
    await expect(
      rewardsService.allocate(testCompetitionId, testStartTimestamp),
    ).rejects.toThrow("no rewards to allocate");

    // Verify no tree nodes or root entries were created
    const treeNodes = await db
      .select()
      .from(rewardsTree)
      .where(eq(rewardsTree.competitionId, testCompetitionId));

    const rootEntries = await db
      .select()
      .from(rewardsRoots)
      .where(eq(rewardsRoots.competitionId, testCompetitionId));

    expect(treeNodes.length).toBe(0);
    expect(rootEntries.length).toBe(0);
  });

  test("allocate method handles single reward correctly", async () => {
    // Prepare single reward with deterministic address
    const address =
      "0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69" as `0x${string}`;
    const amount = BigInt("5");

    // Generate proper leaf hash using the standalone function
    const leafHashBuffer = createLeafNode(address, amount);

    const singleReward: InsertReward[] = [
      {
        id: crypto.randomUUID(),
        competitionId: testCompetitionId,
        userId: testUserId,
        address,
        amount,
        leafHash: hexToBytes(leafHashBuffer), // Convert Buffer to Uint8Array
        claimed: false,
      },
    ];

    // Insert single reward
    await rewardsRepo.insertRewards(singleReward);

    // Execute allocate with all required parameters
    await rewardsService.allocate(testCompetitionId, testStartTimestamp);

    // Verify tree structure for single reward
    const treeNodes = await db
      .select()
      .from(rewardsTree)
      .where(eq(rewardsTree.competitionId, testCompetitionId));

    // Should have 3 nodes (faux, leaf, and root)
    expect(treeNodes.length).toBe(3);

    // Verify root hash was stored
    const rootEntries = await db
      .select()
      .from(rewardsRoots)
      .where(eq(rewardsRoots.competitionId, testCompetitionId));

    expect(rootEntries.length).toBe(1);
    expect(rootEntries[0]?.competitionId).toBe(testCompetitionId);
  });

  test("retrieveProof method verifies multiple rewards", async () => {
    // Prepare multiple rewards with deterministic addresses
    const rewardData = [
      {
        address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" as `0x${string}`,
        amount: BigInt("10"),
      },
      {
        address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30" as `0x${string}`,
        amount: BigInt("20"),
      },
      {
        address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E" as `0x${string}`,
        amount: BigInt("30"),
      },
    ];

    // Create rewards and their leaf hashes
    const testRewards: InsertReward[] = rewardData.map(
      ({ address, amount }) => {
        const leafHashBuffer = createLeafNode(address, amount);
        return {
          id: crypto.randomUUID(),
          competitionId: testCompetitionId,
          userId: testUserId,
          address,
          amount,
          leafHash: hexToBytes(leafHashBuffer),
          claimed: false,
        };
      },
    );

    // Insert rewards and build the Merkle tree
    await rewardsRepo.insertRewards(testRewards);
    await rewardsService.allocate(testCompetitionId, testStartTimestamp);

    // Create a MerkleTree instance to verify proofs
    const rewardEntries = await db
      .select()
      .from(rewards)
      .where(eq(rewards.competitionId, testCompetitionId));

    // Create the leaves array with the faux leaf first
    const fauxLeaf = createFauxLeafNode(testCompetitionId);

    const leaves = [
      fauxLeaf,
      ...rewardEntries.map((reward) => Buffer.from(reward.leafHash)),
    ];

    // Create the MerkleTree with the same configuration as in the service
    const merkleTree = new MerkleTree(leaves, keccak256, {
      sortPairs: true,
      hashLeaves: false,
      sortLeaves: true,
    });

    // Loop through each reward and verify its proof
    for (const { address, amount } of rewardData) {
      // Generate leaf hash for verification
      const leafHashBuffer = createLeafNode(address, amount);

      // Retrieve proof for the reward
      const proof = await rewardsService.retrieveProof(
        testCompetitionId,
        address,
        amount,
      );

      // Verify proof length
      expect(proof.length).toBe(2);

      // Verify each proof element is a Uint8Array of length 32 (keccak256 hash)
      proof.forEach((element) => {
        expect(element).toBeInstanceOf(Uint8Array);
        expect(element.length).toBe(32);
      });

      // Convert the retrieved proof to Buffer array for verification
      const proofBuffers = proof.map((p) => Buffer.from(p));

      // Verify the proof is valid for the leaf
      const isValid = merkleTree.verify(
        proofBuffers,
        leafHashBuffer,
        merkleTree.getRoot(),
      );

      expect(isValid).toBe(true);
    }
  });

  test("retrieveProof method throws error for non-existent reward", async () => {
    // Create a Merkle tree with some rewards first
    const existingAddress =
      "0x2546BcD3c84621e976D8185a91A922aE77ECEc30" as `0x${string}`;
    const existingAmount = BigInt("20");

    const leafHashBuffer = createLeafNode(existingAddress, existingAmount);

    await rewardsRepo.insertRewards([
      {
        id: crypto.randomUUID(),
        competitionId: testCompetitionId,
        userId: testUserId,
        address: existingAddress,
        amount: existingAmount,
        leafHash: hexToBytes(leafHashBuffer),
        claimed: false,
      },
    ]);

    await rewardsService.allocate(testCompetitionId, testStartTimestamp);

    // Try to retrieve proof for a non-existent reward
    const nonExistentAddress =
      "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E" as `0x${string}`;
    const nonExistentAmount = BigInt("30");

    await expect(
      rewardsService.retrieveProof(
        testCompetitionId,
        nonExistentAddress,
        nonExistentAmount,
      ),
    ).rejects.toThrow(
      `No proof found for reward (address: ${nonExistentAddress}, amount: ${nonExistentAmount}) in competition ${testCompetitionId}`,
    );
  });
});
