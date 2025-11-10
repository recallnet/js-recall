import { MerkleTree } from "merkletreejs";
import { Logger } from "pino";
import { Hex, bytesToHex, encodePacked, hexToBytes, keccak256 } from "viem";

import { AgentRepository } from "@recallnet/db/repositories/agent";
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
import { RewardsAllocator } from "@recallnet/staking-contracts";

/**
 * Service for handling reward-related operations
 */
export class RewardsService {
  private rewardsRepo: RewardsRepository;
  private competitionRepository: CompetitionRepository;
  private boostRepository: BoostRepository;
  private agentRepo: AgentRepository;
  private rewardsAllocator: RewardsAllocator;
  private db: Database;
  private logger: Logger;

  constructor(
    rewardsRepo: RewardsRepository,
    competitionRepository: CompetitionRepository,
    boostRepository: BoostRepository,
    agentRepo: AgentRepository,
    rewardsAllocator: RewardsAllocator,
    db: Database,
    logger: Logger,
  ) {
    this.rewardsRepo = rewardsRepo;
    this.competitionRepository = competitionRepository;
    this.boostRepository = boostRepository;
    this.agentRepo = agentRepo;
    this.rewardsAllocator = rewardsAllocator;
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
    startTimestamp?: number | undefined,
  ): Promise<void> {
    if (!startTimestamp) {
      const competition =
        await this.competitionRepository.findById(competitionId);
      if (!competition) {
        throw new Error(
          `Competition not found for competition ${competitionId}`,
        );
      }

      if (!competition.endDate) {
        // set startTimestamp to now if competition has no end date
        startTimestamp = Math.floor(Date.now() / 1000);
      } else {
        // add 1 hour to the end date if competition has an end date
        startTimestamp = Math.floor(
          new Date(competition.endDate.getTime() + 60 * 60 * 1000).getTime() /
            1000,
        );
      }
    }

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

      // Fetch agent details to check for globally ineligible agents
      const agentIds = leaderBoard.map((entry) => entry.competitor);
      const agents = await this.agentRepo.findByIds(agentIds);
      const globallyIneligibleAgents = agents
        .filter((agent) => agent.isRewardsIneligible)
        .map((agent) => agent.id);

      // Combine competition-specific and global exclusions (deduplicated)
      const competitionExclusions = competition.rewardsIneligible ?? [];
      const allExcludedAgents = Array.from(
        new Set([...competitionExclusions, ...globallyIneligibleAgents]),
      );

      this.logger.debug(
        `[RewardsService] Excluding ${allExcludedAgents.length} unique agents from rewards (${competitionExclusions.length} competition-specific, ${globallyIneligibleAgents.length} globally ineligible)`,
      );

      const rewards = this.calculate(
        prizePoolUsers,
        prizePoolCompetitors,
        boostAllocations,
        leaderBoard,
        boostAllocationWindow,
        allExcludedAgents.length > 0 ? allExcludedAgents : undefined,
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
      this.logger.info(
        `[RewardsService] Publishing root hash ${rootHash} to blockchain for competition ${competitionId}`,
      );

      const result = await this.rewardsAllocator.allocate(
        rootHash as Hex,
        allocationAmount,
        startTimestamp,
      );

      this.logger.info(
        `[RewardsService] Successfully published root hash to blockchain. Transaction: ${result.transactionHash}`,
      );

      await runWithConcurrencyLimit(treeNodes, 1000, 10, async (batch) => {
        await transaction.insert(rewardsTree).values(batch);
      });

      await transaction.insert(rewardsRoots).values({
        id: crypto.randomUUID(),
        competitionId: competitionId,
        rootHash: new Uint8Array(merkleTree.getRoot()),
        tx: result.transactionHash,
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
   * Get rewards report data for a competition
   * @param competitionId The competition ID (UUID) to generate report for
   * @returns Report data including competition info, rewards stats, and merkle root
   */
  public async getRewardsReportData(competitionId: string): Promise<{
    competition: {
      id: string;
      name: string;
    };
    merkleRoot: string;
    totalRecipients: number;
    totalBoosters: number;
    totalAgents: number;
    totalRewards: bigint;
    agentRewards: Array<{
      address: string;
      amount: bigint;
    }>;
    boosterRewards: Array<{
      address: string;
      amount: bigint;
    }>;
    boosterStats: {
      average: bigint;
      median: bigint;
      largest: bigint;
      smallest: bigint;
      largestAddress: string;
      smallestAddress: string;
    };
    top5Agents: Array<{
      address: string;
      amount: bigint;
    }>;
    top5Boosters: Array<{
      address: string;
      amount: bigint;
    }>;
  }> {
    const competition =
      await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    const rewardsRoot =
      await this.rewardsRepo.getRewardsRootByCompetition(competitionId);
    if (!rewardsRoot) {
      throw new Error(
        `Rewards root not found for competition: ${competitionId}`,
      );
    }

    const rewards =
      await this.rewardsRepo.getRewardsByCompetition(competitionId);

    // Separate agent rewards (have agentId) from booster rewards (no agentId)
    const agentRewards = rewards
      .filter((r) => r.agentId !== null)
      .map((r) => ({
        address: r.address,
        amount: r.amount,
      }));

    const boosterRewards = rewards
      .filter((r) => r.agentId === null)
      .map((r) => ({
        address: r.address,
        amount: r.amount,
      }));

    // Calculate booster statistics
    const boosterAmounts = boosterRewards
      .map((r) => r.amount)
      .sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

    const calculateMedian = (sorted: bigint[]): bigint => {
      if (sorted.length === 0) return 0n;
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1]! + sorted[mid]!) / 2n;
      }
      return sorted[mid]!;
    };

    const totalBoosterAmount = boosterAmounts.reduce(
      (acc, amount) => acc + amount,
      0n,
    );
    const average =
      boosterAmounts.length > 0
        ? totalBoosterAmount / BigInt(boosterAmounts.length)
        : 0n;
    const median = calculateMedian(boosterAmounts);
    const largest =
      boosterAmounts.length > 0
        ? boosterAmounts[boosterAmounts.length - 1]!
        : 0n;
    const smallest = boosterAmounts.length > 0 ? boosterAmounts[0]! : 0n;

    const largestReward = boosterRewards.find((r) => r.amount === largest);
    const smallestReward = boosterRewards.find((r) => r.amount === smallest);

    const boosterStats = {
      average,
      median,
      largest,
      smallest,
      largestAddress: largestReward?.address || "",
      smallestAddress: smallestReward?.address || "",
    };

    // Get top 5 agents and boosters
    const top5Agents = [...agentRewards]
      .sort((a, b) => {
        if (a.amount < b.amount) return 1;
        if (a.amount > b.amount) return -1;
        return 0;
      })
      .slice(0, 5);

    const top5Boosters = [...boosterRewards]
      .sort((a, b) => {
        if (a.amount < b.amount) return 1;
        if (a.amount > b.amount) return -1;
        return 0;
      })
      .slice(0, 5);

    const totalRewards = rewards.reduce((acc, r) => acc + r.amount, 0n);

    const merkleRoot = `0x${Buffer.from(rewardsRoot.rootHash).toString("hex")}`;

    return {
      competition: {
        id: competition.id,
        name: competition.name || `Competition #${competition.id}`,
      },
      merkleRoot,
      totalRecipients: rewards.length,
      totalBoosters: boosterRewards.length,
      totalAgents: agentRewards.length,
      totalRewards,
      agentRewards,
      boosterRewards,
      boosterStats,
      top5Agents,
      top5Boosters,
    };
  }

  /**
   * Internal method to calculate rewards
   * @param prizePoolUsers Prize pool for users
   * @param prizePoolCompetitors Prize pool for competitors
   * @param boostAllocations Boost allocation data
   * @param leaderBoard Competition leaderboard
   * @param window Boost allocation window
   * @param excludedAgentIds Optional array of agent IDs ineligible for rewards
   * @returns Array of calculated rewards
   * @private
   */
  private calculate(
    prizePoolUsers: bigint,
    prizePoolCompetitors: bigint,
    boostAllocations: BoostAllocation[],
    leaderBoard: Leaderboard,
    window: BoostAllocationWindow,
    excludedAgentIds?: string[],
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

    // Filter out agents ineligible for rewards (per-competition configuration)
    const excludedCompetitors = excludedAgentIds
      ? new Set(excludedAgentIds)
      : new Set();
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
