import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { encodeAbiParameters } from "viem";

import { db } from "@/database/db.js";
import {
  getRewardsByEpoch,
  getRewardsTreeByEpoch,
  insertRewards,
} from "@/database/repositories/rewards-repository.js";
import { rewardsRoots, rewardsTree } from "@/database/schema/voting/defs.js";
import { InsertReward } from "@/database/schema/voting/types.js";

/**
 * Service for handling reward-related operations
 */
export class RewardsService {
  /**
   * Calculate rewards for a given input
   */
  public async calculateRewards(): Promise<void> {
    try {
      const rewards = await this.calculate();
      await insertRewards(rewards);
    } catch (error) {
      console.error("[RewardsService] Error in calculateRewards:", error);
      throw error;
    }
  }

  /**
   * Allocates rewards for a given epoch by building a Merkle Tree and storing it in the database
   *
   * This method:
   * 1. Retrieves all rewards for the specified epoch
   * 2. Builds a Merkle tree from the rewards (including a special "faux" leaf node)
   * 3. Stores all tree nodes and the root hash in the database
   * 4. Will eventually publish the root hash to the blockchain (TODO)
   *
   * @param epochId The epoch ID (UUID) to allocate rewards for
   * @throws Error if no rewards exist for the specified epoch
   */
  public async allocate(epochId: string): Promise<void> {
    try {
      const rewards = await getRewardsByEpoch(epochId);

      // Build Merkle tree if we have rewards
      if (rewards.length == 0) {
        throw Error("no rewards to allocate");
      }

      // Prepend a faux leaf
      const leaves = [
        createFauxLeafNode(epochId),
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
        epoch: string;
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
                epoch: epochId,
                level,
                idx,
                hash: new Uint8Array(hash),
              });
            }
          }
        }
      }

      const rootHash = merkleTree.getRoot();

      await db.transaction(async (tx) => {
        //TODO: call addDistribution blockchain method

        await tx.insert(rewardsTree).values(treeNodes);
        await tx.insert(rewardsRoots).values({
          id: crypto.randomUUID(),
          epoch: epochId,
          rootHash: new Uint8Array(rootHash),
          tx: "", // TODO: This should be set when the root is published to blockchain
        });
      });

      console.log(
        `[RewardsService] Built Merkle tree for epoch ${epochId} with ${treeNodes.length} nodes and root hash: ${rootHash.toString("hex")}`,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error("[RewardsService] Error in allocate:", error);
        throw error;
      }

      console.error(
        "[RewardsService] Unknown error calculating rewards:",
        error,
      );
      throw new Error(`Failed to calculate rewards: ${error}`);
    }
  }

  /**
   * Retrieves a Merkle proof for a specific reward in an epoch
   * @param epochId The epoch ID (UUID) containing the reward
   * @param address The recipient's Ethereum address
   * @param amount The reward amount as a bigint
   * @returns Array of proof hashes as Uint8Array
   * @throws Error if the proof cannot be generated or the reward doesn't exist
   */
  public async retrieveProof(
    epochId: string,
    address: `0x${string}`,
    amount: bigint,
  ): Promise<Uint8Array[]> {
    try {
      const leafHash = createLeafNode(address, amount);

      const tree = await getRewardsTreeByEpoch(epochId);

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
          `No proof found for reward (address: ${address}, amount: ${amount}) in epoch ${epochId}`,
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
      console.error("[RewardsService] Error in retrieveProof:", error);
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
 * Creates a special "faux" leaf node for an epoch
 * @param epochId The UUID of the epoch
 * @returns Buffer containing the keccak256 hash of the encoded parameters with zero address and amount
 * @remarks This node is used as the first leaf in the Merkle tree to ensure unique tree structure
 */
function createFauxLeafNode(epochId: string): Buffer {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      [
        epochId,
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
