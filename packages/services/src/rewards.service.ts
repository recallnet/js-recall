import { MerkleTree } from "merkletreejs";
import { Logger } from "pino";

import { RewardsRepository } from "@recallnet/db/repositories/rewards";


import { Hex, bytesToHex, encodePacked, hexToBytes, keccak256 } from "viem";

import { rewardsRoots, rewardsTree } from "@recallnet/db/schema/voting/defs";
import {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
  Reward,
  calculateRewardsForCompetitors,
  calculateRewardsForUsers,
} from "@recallnet/rewards";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { Database } from "@recallnet/db/types";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";

/**
 * Service for handling reward-related operations
 */
export class RewardsService {
  private rewardsRepo: RewardsRepository;
  private competitionRepository: CompetitionRepository;
  private boostRepository: BoostRepository;
  private rewardsAllocator: RewardsAllocator;


  private db: Database;
  private logger: Logger;

  constructor(
    rewardsRepo: RewardsRepository,
    competitionRepository: CompetitionRepository,
    boostRepository: BoostRepository,
    rewardsAllocator: RewardsAllocator,
    db: Database,
    logger: Logger,
  ) {
    this.rewardsRepo = rewardsRepo;
    this.competitionRepository = competitionRepository;
    this.boostRepository = boostRepository;
    this.rewardsAllocator = rewardsAllocator;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Calculate rewards for a given input
   */
  public async calculateRewards(
    competitionId: string,
    prizePoolUsers: bigint,
    prizePoolCompetitors: bigint,
  ): Promise<void> {
    try {
      const competition = await this.competitionRepository.findById(competitionId);
      if (!competition) {
        throw new Error("Competition not found");
      }

      if (!competition.votingStartDate || !competition.votingEndDate) {
        throw new Error("Voting start or end date not found");
      }

      if (competition.status !== "ended") {
        throw new Error("Competition is not ended");
      }

      const boostAllocationWindow = {
        start: competition.votingStartDate,
        end: competition.votingEndDate,
      };

      const leaderboardWithWallets =
        await this.competitionRepository.findLeaderboardByCompetitionWithWallets(competitionId);
      if (leaderboardWithWallets.length === 0) {
        throw new Error("No leaderboard entries found");
      }
      const leaderBoard = leaderboardWithWallets.map((entry) => ({
        competitor: entry.agentId,
        wallet: entry.userWalletAddress,
        rank: entry.rank,
      }));

      const boostSpendingData =
        await this.boostRepository.userBoostSpending(competitionId);

      const boostAllocations: BoostAllocation[] = boostSpendingData.map(
        (entry) => {
          return {
            user: bytesToHex(entry.wallet) as string,
            competitor: entry.agentId,
            boost: -entry.deltaAmount, // Convert negative spending to positive boost
            timestamp: entry.createdAt,
          };
        },
      );

      const rewards = this.calculate(
        prizePoolUsers,
        prizePoolCompetitors,
        boostAllocations,
        leaderBoard,
        boostAllocationWindow,
      );

      // TODO: add user_id, and agent_id columns to rewards table
      // so we can track the rewards for each user and agent
      await this.rewardsRepo.insertRewards(
        rewards.map((reward) => ({
          competitionId: competitionId,
          address: reward.address,
          amount: reward.amount,
          leafHash: hexToBytes(
            createLeafNode(reward.address as Hex, reward.amount),
          ),
          id: crypto.randomUUID(),
        })),
      );
    } catch (error) {
      this.logger.error("[RewardsService] Error in calculateRewards:", error);
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
    const rewards =
      await this.rewardsRepo.getRewardsByCompetition(competitionId);

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

    await this.db.transaction(async (tx) => {
      this.logger.info(
        `[RewardsService] Publishing root hash ${rootHash} to blockchain for competition ${competitionId}`,
      );

      const result = await this.rewardsAllocator!.allocate(
        rootHash as Hex,
        tokenAddress,
        allocationAmount,
        startTimestamp,
      );

      this.logger.info(
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

    this.logger.debug(
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
    const leafHash = createLeafNode(address, amount);

      const tree =
        await this.rewardsRepo.getRewardsTreeByCompetition(competitionId);

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
      if (areUint8ArraysEqual(hash, hexToBytes(leafHash))) {
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
      const siblingIdx = currentIdx % 2 === 0 ? currentIdx + 1 : currentIdx - 1;
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
  }

  /**
   * Get the total claimable rewards for a specific address
   * @param address The wallet address to get total claimable rewards for
   * @returns The total amount of unclaimed rewards as a bigint
   */
  public async getTotalClaimableRewards(address: string): Promise<bigint> {
    return await this.rewardsRepo.getTotalClaimableRewardsByAddress(address);
  }

  /**
   * Get rewards with proofs for a specific address
   * @param address The wallet address to get rewards with proofs for
   * @returns Array of rewards with merkle root and proof information
   */
  public async getRewardsWithProofs(address: string): Promise<
    Array<{
      merkleRoot: string;
      amount: string;
      proof: string[];
    }>
  > {
    const rewardsWithRoots = await this.rewardsRepo.getRewardsWithRootsByAddress(address);

    const results = [];

    for (const { reward, rootHash } of rewardsWithRoots) {
      const merkleRoot = `0x${Buffer.from(rootHash).toString("hex")}`;

      const proof = await this.retrieveProof(
        reward.competitionId,
        reward.address as `0x${string}`,
        reward.amount,
      );

      const proofHex = proof.map((p) => `0x${Buffer.from(p).toString("hex")}`);

      results.push({
        merkleRoot,
        amount: reward.amount.toString(),
        proof: proofHex,
      });
    }

    return results;
  }

  /**
   * Internal method to calculate rewards
   * @returns Array of calculated rewards
   * @private
   */
  private calculate(
    prizePoolUsers: bigint,
    prizePoolCompetitors: bigint,
    boostAllocations: BoostAllocation[],
    leaderBoard: Leaderboard,
    window: BoostAllocationWindow,
  ): Reward[] {
    const userRewards = calculateRewardsForUsers(
      prizePoolUsers,
      boostAllocations,
      leaderBoard,
      window,
    );
    const competitorRewards = calculateRewardsForCompetitors(
      prizePoolCompetitors,
      leaderBoard,
    );

    // in case an address is both a voter and a competitor, we need to sum the amounts
    const rewards = [...userRewards, ...competitorRewards];
    const rewardsByAddress = rewards.reduce(
      (acc, reward) => {
        acc[reward.address] = (acc[reward.address] || 0n) + reward.amount;
        return acc;
      },
      {} as Record<string, bigint>,
    );

    return Object.entries(rewardsByAddress).map(([address, amount]) => ({
      address,
      amount,
    }));
  }
}

/**
 * Creates a Merkle leaf node by hashing reward data
 * @param address The recipient's Ethereum address
 * @param amount The reward amount as a bigint
 * @returns Buffer containing the keccak256 hash of the encoded parameters
 */
export function createLeafNode(address: Hex, amount: bigint): Hex {
  return keccak256(
    encodePacked(["string", "address", "uint256"], ["rl", address, amount]),
  );
}

/**
 * Creates a special "faux" leaf node for a competition
 * @param competitionId The UUID of the competition
 * @returns Buffer containing the keccak256 hash of the encoded parameters with zero address and amount
 * @remarks This node is used as the first leaf in the Merkle tree to ensure unique tree structure
 */
export function createFauxLeafNode(competitionId: string): Hex {
  return keccak256(
    encodePacked(
      ["string", "address", "uint256"],
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
