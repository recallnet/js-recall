import { MerkleTree } from "merkletreejs";
import { Logger } from "pino";
import { Hex, bytesToHex, encodePacked, hexToBytes, keccak256 } from "viem";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { rewardsRoots, rewardsTree } from "@recallnet/db/schema/rewards/defs";
import { Database, Transaction } from "@recallnet/db/types";
import {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
  Reward,
  calculateRewardsForCompetitors,
  calculateRewardsForUsers,
} from "@recallnet/rewards";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

/**
 * Service for handling reward-related operations
 */
export class RewardsService {
  private rewardsRepo: RewardsRepository;
  private competitionRepository: CompetitionRepository;
  private boostRepository: BoostRepository;
  private rewardsAllocator?: RewardsAllocator;
  private db: Database;
  private logger: Logger;

  constructor(
    rewardsRepo: RewardsRepository,
    competitionRepository: CompetitionRepository,
    boostRepository: BoostRepository,
    rewardsAllocator: RewardsAllocator | null | undefined,
    db: Database,
    logger: Logger,
  ) {
    this.rewardsRepo = rewardsRepo;
    this.competitionRepository = competitionRepository;
    this.boostRepository = boostRepository;
    this.rewardsAllocator = rewardsAllocator ?? undefined;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Calculate rewards and allocate them for a competition
   *
   * This method combines the reward calculation and allocation process within a single database transaction:
   * 1. Calculates rewards using the internal calculation logic
   * 2. Stores the calculated rewards in the database
   * 3. Allocates the rewards by building a Merkle tree and publishing to blockchain
   *
   * @param competitionId The competition ID (UUID) to calculate and allocate rewards for
   * @param startTimestamp The timestamp from which rewards can be claimed
   * @throws Error if reward calculation fails or no rewards exist to allocate
   */
  public async calculateAndAllocate(
    competitionId: string,
    startTimestamp: number,
  ): Promise<void> {
    const prizePool =
      await this.competitionRepository.getCompetitionPrizePools(competitionId);
    if (!prizePool) {
      throw new Error(`No prize pool found for competition ${competitionId}`);
    }

    await this.db.transaction(async (tx) => {
      await this.calculateRewards(
        competitionId,
        prizePool.userPool,
        prizePool.agentPool,
        tx,
      );
      await this.allocate(competitionId, startTimestamp, tx);
    });
  }

  /**
   * Calculate rewards for a given competition
   * @param competitionId The competition ID to calculate rewards for
   * @param prizePoolUsers The prize pool amount for users
   * @param prizePoolCompetitors The prize pool amount for competitors
   * @param tx Optional database transaction to use for database operations
   */
  public async calculateRewards(
    competitionId: string,
    prizePoolUsers: bigint,
    prizePoolCompetitors: bigint,
    tx?: Transaction,
  ): Promise<void> {
    try {
      const competition =
        await this.competitionRepository.findById(competitionId);
      if (!competition) {
        throw new Error("Competition not found");
      }

      if (!competition.boostStartDate || !competition.boostEndDate) {
        throw new Error("Boost start or end date not found");
      }

      if (competition.status !== "ended") {
        throw new Error("Competition is not ended");
      }

      const boostAllocationWindow = {
        start: competition.boostStartDate,
        end: competition.boostEndDate,
      };

      const leaderboardWithWallets =
        await this.competitionRepository.findLeaderboardByCompetitionWithWallets(
          competitionId,
        );
      if (leaderboardWithWallets.length === 0) {
        throw new Error("No leaderboard entries found");
      }
      const leaderBoard = leaderboardWithWallets.map((entry) => ({
        owner: entry.ownerId,
        competitor: entry.agentId,
        wallet: entry.userWalletAddress,
        rank: entry.rank,
      }));

      const boostSpendingData =
        await this.boostRepository.userBoostSpending(competitionId);

      const boostAllocations: BoostAllocation[] = boostSpendingData.map(
        (entry) => {
          return {
            user_id: entry.userId,
            user_wallet: bytesToHex(entry.wallet) as string,
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

      const rewardsToInsert = rewards.map((reward) => ({
        userId: reward.owner,
        agentId: reward.competitor ?? null,
        competitionId: competitionId,
        address: reward.address.toLowerCase(),
        amount: reward.amount,
        leafHash: hexToBytes(
          createLeafNode(reward.address as Hex, reward.amount),
        ),
        id: crypto.randomUUID(),
      }));
      await runWithConcurrencyLimit(
        rewardsToInsert,
        1000,
        10,
        async (batch) => {
          await this.rewardsRepo.insertRewards(batch, tx);
        },
      );
    } catch (error) {
      this.logger.error(
        { error },
        "[RewardsService] Error in calculateRewards",
      );
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
   * @param startTimestamp The timestamp from which rewards can be claimed
   * @param tx Optional database transaction to use for database operations
   * @throws Error if no rewards exist for the specified competition
   */
  public async allocate(
    competitionId: string,
    startTimestamp: number,
    tx?: Transaction,
  ): Promise<void> {
    const rewards = await this.rewardsRepo.getRewardsByCompetition(
      competitionId,
      tx,
    );

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

    const executeWithTransaction = async (transaction: Transaction) => {
      let transactionHash: string;

      if (this.rewardsAllocator) {
        this.logger.info(
          `[RewardsService] Publishing root hash ${rootHash} to blockchain for competition ${competitionId}`,
        );

        const result = await this.rewardsAllocator.allocate(
          rootHash as Hex,
          allocationAmount,
          startTimestamp,
        );

        transactionHash = result.transactionHash;

        this.logger.info(
          `[RewardsService] Successfully published root hash to blockchain. Transaction: ${transactionHash}`,
        );
      } else {
        // When allocator is not provided, proceed with off-chain allocation and record a placeholder tx value
        transactionHash = "offchain";
        this.logger.warn(
          `[RewardsService] RewardsAllocator not provided. Skipping on-chain publish for competition ${competitionId}. Recording tx="${transactionHash}"`,
        );
      }

      await runWithConcurrencyLimit(treeNodes, 1000, 10, async (batch) => {
        await transaction.insert(rewardsTree).values(batch);
      });

      await transaction.insert(rewardsRoots).values({
        id: crypto.randomUUID(),
        competitionId: competitionId,
        rootHash: new Uint8Array(merkleTree.getRoot()),
        tx: transactionHash,
      });
    };

    if (tx) {
      await executeWithTransaction(tx);
    } else {
      await this.db.transaction(executeWithTransaction);
    }

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
    const rewardsWithRoots =
      await this.rewardsRepo.getRewardsWithRootsByAddress(address);

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

    // TODO: this is a temporary solution to exclude specific competitors from competitorRewards
    const excludedCompetitors = new Set<string>([
      "b656119a-2d28-4b91-9914-44a8506625ab",
      "db1e1798-97c1-4613-962b-c95e19c2bbb7",
      "a3cd2e8d-ecfe-4c13-a825-4fde06b0f65c",
      "ad77de46-86a3-41dd-97ef-b30aa3d7b150",
      "36e5fa9b-151a-4a62-95d4-620f610e0273",
      "b6418f67-a922-418e-a1db-34483141a5e2",
    ]);
    const filteredCompetitorRewards = competitorRewards.filter(
      (reward) =>
        reward.competitor && !excludedCompetitors.has(reward.competitor),
    );

    return [...userRewards, ...filteredCompetitorRewards];
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

function* chunkGenerator<T>(array: T[], size: number): Generator<T[]> {
  for (let i = 0; i < array.length; i += size) {
    yield array.slice(i, i + size);
  }
}

async function runWithConcurrencyLimit<T>(
  rows: T[],
  batchSize: number,
  concurrency: number,
  worker: (batch: T[]) => Promise<void>,
): Promise<void> {
  const iterator = chunkGenerator(rows, batchSize);

  let active = 0;
  let done = false;

  return new Promise((resolve, reject) => {
    function launchNext() {
      const { value: batch, done: iterDone } = iterator.next();
      if (iterDone) {
        done = true;
        if (active === 0) resolve();
        return;
      }

      active++;
      worker(batch)
        .then(() => {
          active--;
          launchNext();
          if (done && active === 0) resolve();
        })
        .catch(reject);
    }

    for (let i = 0; i < concurrency; i++) {
      launchNext();
    }
  });
}
