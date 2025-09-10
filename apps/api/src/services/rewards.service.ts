import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { Hex, encodeAbiParameters } from "viem";

import { rewardsRoots, rewardsTree } from "@recallnet/db-schema/voting/defs";
import { InsertReward } from "@recallnet/db-schema/voting/types";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import {
  getRewardsByCompetition,
  getRewardsTreeByCompetition,
  insertRewards,
} from "@/database/repositories/rewards-repository.js";
import { serviceLogger } from "@/lib/logger.js";

/**
 * Service for handling reward-related operations
 */
export class RewardsService {
  private rewardsAllocator: RewardsAllocator | null = null;

  constructor(rewardsAllocator?: RewardsAllocator) {
    if (rewardsAllocator) {
      this.rewardsAllocator = rewardsAllocator;
    } else {
      const { allocatorPrivateKey, contractAddress, rpcProvider } =
        config.rewards;

      if (!allocatorPrivateKey || !contractAddress || !rpcProvider) {
        serviceLogger.warn(
          "[RewardsService] Rewards configuration incomplete. RewardsAllocator will not be initialized.",
        );
        return;
      }

      this.rewardsAllocator = new RewardsAllocator(
        allocatorPrivateKey as Hex,
        rpcProvider,
        contractAddress as Hex,
      );
    }
  }

  /**
   * Calculate rewards for a given input
   */
  public async calculateRewards(): Promise<void> {
    try {
      const rewards = await this.calculate();
      await insertRewards(rewards);
    } catch (error) {
      serviceLogger.error("[RewardsService] Error in calculateRewards:", error);
      throw error;
    }
  }

  /**
   * Allocates rewards for a given competition by building a Merkle Tree and storing it in the database
   *
   * This method:
   * 1. Retrieves all rewards for the specified competition
   * 2. Builds a Merkle tree from the rewards (including a special "faux" leaf node)
   * 3. Stores all tree nodes and the root hash in the database
   * 4. Publishes the root hash to the blockchain if RewardsAllocator is available
   *
   * @param competitionId The competition ID (UUID) to allocate rewards for
   * @param tokenAddress The ERC20 token address for this allocation
   * @param startTimestamp The timestamp from which rewards can be claimed
   * @throws Error if no rewards exist for the specified competition
   */
  public async allocate(
    competitionId: string,
    tokenAddress: Hex,
    startTimestamp: number,
  ): Promise<void> {
    const rewards = await getRewardsByCompetition(competitionId);

    // Build Merkle tree if we have rewards
    if (rewards.length == 0) {
      throw Error("no rewards to allocate");
    }

    const allocationAmount = rewards.reduce(
      (acc, reward) => acc + reward.amount,
      0n,
    );

    // Prepend a faux leaf
    const leaves = [
      createFauxLeafNode(competitionId),
      ...rewards.map((reward) => reward.leafHash),
    ];
    const merkleTree = new MerkleTree(leaves, keccak256, {
      sortPairs: true,
      hashLeaves: false,
      sortLeaves: true,
    });

    const layers = merkleTree.getLayers();
    const treeNodes: {
      id: string;
      competitionId: string;
      level: number;
      idx: number;
      hash: Uint8Array;
    }[] = [];

    for (let level = 0; level < layers.length; level++) {
      const layer = layers[level];

      if (layer) {
        for (let idx = 0; idx < layer.length; idx++) {
          const hash = layer[idx];

          if (hash) {
            treeNodes.push({
              id: crypto.randomUUID(),
              competitionId: competitionId,
              level,
              idx,
              hash: new Uint8Array(hash),
            });
          }
        }
      }
    }

    const rootHash = merkleTree.getHexRoot();

    await db.transaction(async (tx) => {
      serviceLogger.info(
        `[RewardsService] Publishing root hash ${rootHash} to blockchain for competition ${competitionId}`,
      );

      const result = await this.rewardsAllocator!.allocate(
        rootHash as Hex,
        tokenAddress,
        allocationAmount,
        startTimestamp,
      );

      serviceLogger.info(
        `[RewardsService] Successfully published root hash to blockchain. Transaction: ${result.transactionHash}`,
      );

      await tx.insert(rewardsTree).values(treeNodes);
      await tx.insert(rewardsRoots).values({
        id: crypto.randomUUID(),
        competitionId: competitionId,
        rootHash: new Uint8Array(merkleTree.getRoot()),
        tx: result.transactionHash,
      });
    });

    serviceLogger.debug(
      `[RewardsService] Built Merkle tree for competition ${competitionId} with ${treeNodes.length} nodes and root hash: ${rootHash}`,
    );
  }

  /**
   * Retrieves a Merkle proof for a specific reward in a competition
   * @param competitionId The competition ID (UUID) containing the reward
   * @param address The recipient's Ethereum address
   * @param amount The reward amount as a bigint
   * @returns Array of proof hashes as Uint8Array
   * @throws Error if the proof cannot be generated or the reward doesn't exist
   */
  public async retrieveProof(
    competitionId: string,
    address: `0x${string}`,
    amount: bigint,
  ): Promise<Uint8Array[]> {
    try {
      const leafHash = createLeafNode(address, amount);

      const tree = await getRewardsTreeByCompetition(competitionId);

      const treeNodes: { [level: number]: { [idx: number]: Uint8Array } } = {};
      for (const { level, idx, hash } of tree) {
        if (!treeNodes[level]) {
          treeNodes[level] = {};
        }
        treeNodes[level][idx] = hash;
      }

      // Search for the leaf hash
      let leafIdx: number | null = null;
      for (const [idxStr, hash] of Object.entries(treeNodes[0] || {})) {
        const idx = parseInt(idxStr);
        if (areUint8ArraysEqual(hash, leafHash)) {
          leafIdx = idx;
          break;
        }
      }

      if (leafIdx === null) {
        throw new Error(
          `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
        );
      }

      const proof: Uint8Array[] = [];
      const maxLevel = Math.max(...Object.keys(treeNodes).map(Number));

      let currentLevel = 0;
      let currentIdx = leafIdx;
      while (currentLevel < maxLevel) {
        // Determine sibling index
        const siblingIdx =
          currentIdx % 2 === 0 ? currentIdx + 1 : currentIdx - 1;
        const sibling = treeNodes[currentLevel]?.[siblingIdx];

        // Add sibling to proof if it exists
        if (sibling) {
          proof.push(sibling);
        }

        // Move up to parent
        currentIdx = Math.floor(currentIdx / 2);
        currentLevel++;
      }

      return proof;
    } catch (error) {
      serviceLogger.error("[RewardsService] Error in retrieveProof:", error);
      throw error;
    }
  }

  /**
   * Internal method to calculate rewards
   * @returns Array of calculated rewards
   * @private
   */
  private async calculate(): Promise<InsertReward[]> {
    // TODO: Implement actual reward calculation logic
    return [];
  }
}

/**
 * Creates a Merkle leaf node by hashing reward data
 * @param address The recipient's Ethereum address
 * @param amount The reward amount as a bigint
 * @returns Buffer containing the keccak256 hash of the encoded parameters
 */
export function createLeafNode(address: `0x${string}`, amount: bigint): Buffer {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      ["rl", address, amount],
    ),
  );
}

/**
 * Creates a special "faux" leaf node for a competition
 * @param competitionId The UUID of the competition
 * @returns Buffer containing the keccak256 hash of the encoded parameters with zero address and amount
 * @remarks This node is used as the first leaf in the Merkle tree to ensure unique tree structure
 */
function createFauxLeafNode(competitionId: string): Buffer {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      [
        competitionId,
        "0x0000000000000000000000000000000000000000" as `0x${string}`,
        BigInt("0"),
      ],
    ),
  );
}

// Helper function to compare two Uint8Arrays
function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
