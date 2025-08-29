import { eq } from "drizzle-orm";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { encodeAbiParameters } from "viem";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { insertRewards } from "@/database/repositories/rewards-repository.js";
import { competitions } from "@/database/schema/core/defs.js";
import {
  rewards,
  rewardsRoots,
  rewardsTree,
} from "@/database/schema/voting/defs.js";
import { InsertReward } from "@/database/schema/voting/types.js";
import { RewardsService, createLeafNode } from "@/services/rewards.service.js";

describe("Rewards Service", () => {
  let rewardsService: RewardsService;
  let testCompetitionId: string;

  beforeEach(async () => {
    rewardsService = new RewardsService();

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
        address,
        amount,
        leafHash: new Uint8Array(leafHashBuffer), // Convert Buffer to Uint8Array
        claimed: false,
      });
    }

    // Insert test rewards into database
    await insertRewards(testRewards);

    // Execute the allocate method
    await rewardsService.allocate(testCompetitionId);

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
      "2139ba0bff060eae6c6def620e29a004f4f3c2ea869066dd258ad30959ed16b7",
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
  });

  test("allocate method throws error when no rewards exist for competition", async () => {
    // Try to allocate rewards for a competition with no rewards
    await expect(rewardsService.allocate(testCompetitionId)).rejects.toThrow(
      "no rewards to allocate",
    );

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
        address,
        amount,
        leafHash: new Uint8Array(leafHashBuffer), // Convert Buffer to Uint8Array
        claimed: false,
      },
    ];

    // Insert single reward
    await insertRewards(singleReward);

    // Execute allocate
    await rewardsService.allocate(testCompetitionId);

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
          address,
          amount,
          leafHash: new Uint8Array(leafHashBuffer),
          claimed: false,
        };
      },
    );

    // Insert rewards and build the Merkle tree
    await insertRewards(testRewards);
    await rewardsService.allocate(testCompetitionId);

    // Create a MerkleTree instance to verify proofs
    const rewardEntries = await db
      .select()
      .from(rewards)
      .where(eq(rewards.competitionId, testCompetitionId));

    // Create the leaves array with the faux leaf first
    const fauxLeaf = keccak256(
      encodeAbiParameters(
        [{ type: "string" }, { type: "address" }, { type: "uint256" }],
        [
          testCompetitionId,
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
          BigInt("0"),
        ],
      ),
    );

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

    await insertRewards([
      {
        id: crypto.randomUUID(),
        competitionId: testCompetitionId,
        address: existingAddress,
        amount: existingAmount,
        leafHash: new Uint8Array(leafHashBuffer),
        claimed: false,
      },
    ]);

    await rewardsService.allocate(testCompetitionId);

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
