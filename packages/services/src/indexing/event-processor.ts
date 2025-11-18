import { QueryResponse } from "@envio-dev/hypersync-client";
import type { Logger } from "pino";
import { decodeEventLog, hexToBytes } from "viem";

import { db } from "@recallnet/db";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import type { StakesRepository } from "@recallnet/db/repositories/stakes";

import type { BoostAwardService } from "@/boost-award.service.js";
import type { CompetitionService } from "@/competition.service.js";
import { EVENTS, EVENT_HASH_NAMES } from "@/indexing/blockchain-config.js";
import type { EventData, RawLog } from "@/indexing/blockchain-types.js";
import type { EventsRepository } from "@/indexing/events.repository.js";

export { EventProcessor };

/**
 * Bridge between decoded blockchain logs and our persistence layer.
 * Takes a normalized `EventData` (from the indexing loop) and:
 *   1) Applies stake lifecycle mutations via `StakesRepository` (which writes
 *      both `stakes` and `stake_changes` atomically).
 *   2) Persists the raw event into `indexing_events` via `EventsRepository`.
 *
 * Guarantees / invariants:
 * - **Idempotency: ** Before any mutation, we check `EventsRepository.isEventPresent`
 *   using (block_number, tx_hash, log_index). If present → skip. If absent →
 *   process the event and then save it. This ensures at-most-once application even
 *   if the indexer replays or crashes mid-batch.
 * - **Ordering: ** The indexer (IndexingService.loop) streams logs in block order
 *   and advances `fromBlock = nextBlock`. Within a block, we rely on `logIndex`.
 * - **Atomic stake updates: ** Each repository method (stake/unstake/relock/withdraw)
 *   must update `stakes` and append to `stake_changes` in the **same DB transaction**.
 * - **Separation of concerns: ** This class does no SQL. It decodes ABI args and
 *   coordinates repositories. All DB invariants live in the repos + schema.
 *
 * Relationships:
 * - Consumed by `IndexingService`: it calls `processEvent()` per log.
 * - Writes to tables: `indexing_events` (raw intake), `stakes` (current state),
 *   `stake_changes` (immutable journal).
 * - Upstream config/ABIs: `EVENTS` (+ `EVENT_HASH_NAMES`) defines the event ABI fragments.
 *
 * Extensibility:
 * - To support a new event: add ABI to `EVENTS`, extend the switch in `processEvent`,
 *   and implement `process<NAME>Event()` that calls into `StakesRepository` appropriately.
 *
 * Error handling:
 * - Unknown/malformed events are logged and skipped (no DB writes).
 * - Repository errors bubble up; the caller (IndexingService.loop) will log/retry/abort.
 */
class EventProcessor {
  // repositories
  readonly #eventsRepository: EventsRepository;
  readonly #rewardsRepository: RewardsRepository;
  readonly #stakesRepository: StakesRepository;

  // services
  readonly #boostAwardService: BoostAwardService;
  readonly #competitionService: CompetitionService;

  readonly #logger: Logger;
  readonly #db: typeof db;

  constructor(
    database: typeof db,
    rewardsRepository: RewardsRepository,
    eventsRepository: EventsRepository,
    stakesRepository: StakesRepository,
    boostAwardService: BoostAwardService,
    competitionService: CompetitionService,
    logger: Logger,
  ) {
    this.#db = database;
    this.#rewardsRepository = rewardsRepository;
    this.#eventsRepository = eventsRepository;
    this.#stakesRepository = stakesRepository;
    this.#boostAwardService = boostAwardService;
    this.#competitionService = competitionService;
    this.#logger = logger;
  }

  async process(res: QueryResponse) {
    if (res.data && res.data.logs && res.data.logs.length > 0) {
      this.#logger.info(
        `Processing ${res.data.logs.length} logs from block ${
          res.data.logs[0]?.blockNumber || "unknown"
        }`,
      );

      // Create a map of block number to block timestamp from the returned block data
      const blockTimestampMap = new Map<string, number>();
      if (res.data.blocks && res.data.blocks.length > 0) {
        for (const block of res.data.blocks) {
          if (block.number && block.timestamp) {
            blockTimestampMap.set(
              block.number.toString(),
              Number(block.timestamp),
            );
          }
        }
      }

      // Enhance logs with block timestamp before processing
      const enhancedLogs = res.data.logs.map((log) => {
        const blockNumber = log.blockNumber?.toString() || "unknown";
        const blockTimestamp = blockTimestampMap.get(blockNumber!);
        return {
          ...log,
          blockTimestamp: blockTimestamp,
        } as RawLog;
      });
      for (const log of enhancedLogs) {
        await this.processLog(log);
      }
    }
  }

  /**
   * Handle a single raw log from Hypersync.
   *
   * - Extracts `topic0` and maps it to a known event name via EVENT_HASH_NAMES.
   * - Skips unknown events.
   * - Builds an EventData record (createEventData).
   * - Delegates to EventProcessor.processEvent() to persist into DB.
   *
   * Logging:
   * - Debug logs show event name, block number, tx hash.
   *
   * @internal
   */
  async processLog(rawLog: RawLog): Promise<void> {
    const eventHash = rawLog.topics ? rawLog.topics[0] : null;
    if (!eventHash) {
      return;
    }
    const contractAddress = rawLog.address;
    const eventName = EVENT_HASH_NAMES[eventHash];
    if (eventName) {
      this.#logger.debug(
        `Processing log (${eventName}) from contract ${contractAddress}`,
      );
      // Create raw event data
      const event = this.createEventData(eventName, rawLog);

      this.#logger.debug(
        {
          eventName,
          blockNumber: event.blockNumber.toString(),
          transactionHash: event.transactionHash,
        },
        "Preparing to store raw event with metadata:",
      );

      await this.processEvent(event, eventName);
    } else {
      this.#logger.debug(`Skipped Unknown event hash: ${eventHash}`);
    }
  }

  /**
   * Orchestrate processing of a single blockchain event.
   *
   * Inputs:
   * - `event`: normalized chain metadata + raw payload (`EventData`) ready to save
   *   to `indexing_events`.
   * - `eventName`: canonical ABI name ("Stake" | "Unstake" | "Relock" | "Withdraw").
   *
   * Steps:
   * 1) **Idempotency check**: `eventsRepository.isEventPresent(blockNumber, txHash, logIndex)`.
   *    - If true → log and return (no side effects).
   * 2) **Dispatch**: decode and route to the specific handler:
   *    - Stake → `processStakeEvent`
   *    - Unstake → `processUnstakeEvent`
   *    - Relock → `processRelockEvent`
   *    - Withdraw → `processWithdrawEvent`
   * 3) **Record intake**: `eventsRepository.save(event)` writes to `indexing_events`
   *    after the stake mutation succeeds.
   *
   * Side effects:
   * - On first-time processing, mutates `stakes` + `stake_changes` (via repo) and
   *   appends the raw event to `indexing_events`.
   */
  async processEvent(event: EventData, eventName: string): Promise<void> {
    // Step 1: Check if event already exists (to avoid reprocessing)
    const isEventPresent = await this.#eventsRepository.isEventPresent(
      event.blockNumber,
      event.transactionHash,
      event.logIndex,
    );
    if (isEventPresent) {
      this.#logger.warn(
        `Event already exists, skipping: ${event.transactionHash}...`,
      );
      return;
    }

    if (!event.raw || !event.raw.topics || !event.raw.data) {
      this.#logger.error(
        `Invalid raw event data for event ${eventName}: missing topics or data`,
      );
    }
    // Parse and process based on event type
    switch (eventName) {
      // TODO: instead of hard coding Strings that match the config, can we use
      //       the config? i.e. foreach: if name equal use processor
      case "Stake":
        await this.processStakeEvent(event);
        break;
      case "Unstake":
        await this.processUnstakeEvent(event);
        break;
      case "Relock":
        await this.processRelockEvent(event);
        break;
      case "Withdraw":
        await this.processWithdrawEvent(event);
        break;
      case "RewardClaimed":
        await this.processRewardClaimedEvent(event);
        break;
      case "AllocationAdded":
        await this.processAllocationAddedEvent(event);
        break;
      default:
        this.#logger.warn(
          `Unknown event type for stakes processing: ${eventName}`,
        );
    }
    const isEventAdded = await this.#eventsRepository.append(event);
    if (isEventAdded) {
      this.#logger.info(
        `Blockchain event added to database: ${event.transactionHash}`,
      );
    }
    this.#logger.info(
      `Successfully processed ${event.type} event (tx: ${event.transactionHash})`,
    );
    return;
  }

  /**
   * Helper: normalize a raw blockchain log into our internal `EventData` format.
   *
   * - Copies chain metadata (block number, hash, tx hash, log index).
   * - Converts blockTimestamp (seconds → JS Date).
   * - Preserves raw payload (topics + data + address) for replay/audit.
   * - Classifies into EventType using EVENTS config; defaults to "unknown".
   */
  createEventData(eventName: string, rawLog: RawLog): EventData {
    const eventConfig = EVENTS[eventName as keyof typeof EVENTS];

    const blockTimestamp =
      rawLog.blockTimestamp && typeof rawLog.blockTimestamp === "number"
        ? rawLog.blockTimestamp * 1000
        : undefined;

    return {
      // Blockchain metadata
      blockNumber: BigInt(rawLog.blockNumber || 0),
      blockHash: rawLog.blockHash || "",
      blockTimestamp: blockTimestamp ? new Date(blockTimestamp) : new Date(),
      transactionHash: rawLog.transactionHash || "",
      logIndex: rawLog.logIndex || 0,

      // Raw event payload
      raw: {
        topics: rawLog.topics,
        data: rawLog.data,
        address: rawLog.address,
      },
      type: eventConfig?.type || "unknown",
      // Indexer metadata
      createdAt: new Date(),
    };
  }

  /**
   * Handle "Stake" event.
   *
   * Decoding (from `EVENTS.Stake.abi`):
   * - staker: address
   * - tokenId: uint256 (stake/receipt id)
   * - amount: uint256 (U256, no decimals)
   * - startTime: uint256 (seconds since UNIX epoch)
   * - lockupEndTime: uint256 (seconds since UNIX epoch)
   *
   * Derived:
   * - duration = lockupEndTime - startTime (seconds)
   *
   * Persistence:
   * - Calls `StakesRepository.stake({ stakeId, wallet, amount, duration, …chain coords… })`
   *   which creates the `stakes` row (if new) and appends a `stake_changes` row (delta +amount).
   *
   * Notes:
   * - Repository is responsible for lowercasing wallet, optimistic guards, and atomicity.
   */
  async processStakeEvent(event: EventData): Promise<void> {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.Stake.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });
    const tokenId = decodedEvent.args.tokenId;
    const staker = decodedEvent.args.staker;
    const amount = decodedEvent.args.amount;
    const stakedAt = Math.floor(event.blockTimestamp.getTime() / 1000); // seconds;
    const lockupEndTime = Number(decodedEvent.args.lockupEndTime); // seconds;
    const duration = lockupEndTime - stakedAt;
    const isStakeAdded = await this.#db.transaction(async (tx) => {
      const stake = await this.#stakesRepository.stake(
        {
          stakeId: tokenId,
          wallet: staker,
          amount: amount,
          duration: duration,
          blockNumber: event.blockNumber,
          blockHash: event.blockHash,
          blockTimestamp: event.blockTimestamp,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        },
        tx,
      );
      if (stake) {
        const competitions =
          await this.#competitionService.getOpenForBoosting();
        this.#logger.debug(
          { compsOpenForBoosting: competitions.map((c) => c.id) },
          `Found ${competitions.length} competitions open for boosting`,
        );
        await Promise.all(
          competitions.map((competition) =>
            this.#boostAwardService.awardForStake(
              {
                id: tokenId,
                wallet: staker,
                amount: amount,
                stakedAt: stake.stakedAt,
                canUnstakeAfter: stake.canUnstakeAfter,
              },
              {
                id: competition.id,
                boostStartDate: competition.boostStartDate!,
                boostEndDate: competition.boostEndDate!,
              },
              tx,
            ),
          ),
        );
      }
      return stake;
    });
    if (isStakeAdded) {
      this.#logger.info(
        `Staked ${amount} tokens for ${staker} at ${event.blockNumber} (${event.transactionHash})`,
      );
    }
  }

  /**
   * Handle "Unstake" event.
   *
   * Decoding (from `EVENTS.Unstake.abi`):
   * - tokenId: uint256
   * - amountToUnstake: uint256
   * - withdrawAllowedTime: uint64 (seconds)
   *
   * Derived:
   * - canWithdrawAfter = new Date(withdrawAllowedTime * 1000)
   *
   * Persistence:
   * - Calls `StakesRepository.unstake({ stakeId, amountUnstaked, canWithdrawAfter, … })`
   *   which updates `stakes` (partial or full unstake) and appends a `stake_changes`
   *   row with delta = amountStaked − amountUnstaked.
   *   `amountUnstaked` is the remaining balance for this staked position. 0 means full unstake.
   */
  async processUnstakeEvent(event: EventData) {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.Unstake.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });
    const tokenId = decodedEvent.args.tokenId;
    const amountUnstaked = decodedEvent.args.amountToUnstake;
    const canWithdrawAfter = new Date(
      Number(decodedEvent.args.withdrawAllowedTime) * 1000,
    );
    await this.#stakesRepository.unstake({
      stakeId: tokenId,
      remainingAmount: amountUnstaked,
      canWithdrawAfter: canWithdrawAfter,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      blockTimestamp: event.blockTimestamp,
      txHash: event.transactionHash,
      logIndex: event.logIndex,
    });
  }

  /**
   * Handle "Relock" event.
   *
   * Decoding (from `EVENTS.Relock.abi`):
   * - tokenId: uint256
   * - updatedOldStakeAmount: uint256 (new active amount after relock)
   *
   * Persistence:
   * - Calls `StakesRepository.relock({ stakeId, updatedAmount, … })`
   *   which sets `relockedAt`/`unstakedAt` timestamps and updates `amount`
   *   (full or partial), plus appends a `stake_changes` delta (typically negative
   *   when moving active → relocked).
   */
  async processRelockEvent(event: EventData) {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.Relock.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });
    const tokenId = decodedEvent.args.tokenId;
    const updatedAmount = decodedEvent.args.updatedOldStakeAmount;
    await this.#stakesRepository.relock({
      stakeId: tokenId,
      updatedAmount: updatedAmount,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      blockTimestamp: event.blockTimestamp,
      txHash: event.transactionHash,
      logIndex: event.logIndex,
    });
  }

  /**
   * Handle the "Withdraw" event.
   *
   * Decoding (from `EVENTS.Withdraw.abi`):
   * - tokenId: uint256
   * - amount: uint256 (not used directly here; repo may rely on current state)
   *
   * Persistence:
   * - Calls `StakesRepository.withdraw({ stakeId, … })`
   *   which marks the stake as withdrawn and appends a `stake_changes` entry
   *   (delta typically 0 for a pure status change, or negative if modeled that way).
   */
  async processWithdrawEvent(event: EventData) {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.Withdraw.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });
    const tokenId = decodedEvent.args.tokenId;
    await this.#stakesRepository.withdraw({
      stakeId: tokenId,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      blockTimestamp: event.blockTimestamp,
      txHash: event.transactionHash,
      logIndex: event.logIndex,
    });
  }

  /**
   * Handle the "RewardClaimed" event.
   *
   * Decoding (from `EVENTS.RewardClaimed.abi`):
   * - root: bytes32 (merkle root hash)
   * - user: address (user who claimed the reward)
   * - amount: uint256 (amount of reward claimed)
   *
   * Persistence:
   * - Calls `findCompetitionByRootHash` to get the competition ID from the root hash
   * - Calls `markRewardAsClaimed` to update the claimed status in the rewards table
   */
  async processRewardClaimedEvent(event: EventData) {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.RewardClaimed.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });

    const root = decodedEvent.args.root;
    const user = decodedEvent.args.user;
    const amount = decodedEvent.args.amount;

    const rootHashBytes = hexToBytes(root);

    const competitionId =
      await this.#rewardsRepository.findCompetitionByRootHash(rootHashBytes);
    if (!competitionId) {
      this.#logger.warn(
        `No competition found for root hash ${root} in RewardClaimed event (${event.transactionHash})`,
      );
      return;
    }

    const updatedReward = await this.#rewardsRepository.markRewardAsClaimed(
      competitionId,
      user,
      amount,
    );

    if (updatedReward) {
      this.#logger.info(
        `Marked reward as claimed for user ${user} in competition ${competitionId}`,
      );
    } else {
      this.#logger.warn(
        `No reward found to mark as claimed for user ${user} in competition ${competitionId}`,
      );
    }
  }

  /**
   * Handle the "AllocationAdded" event.
   *
   * Decoding (from `EVENTS.AllocationAdded.abi`):
   * - root: bytes32 (merkle root hash)
   * - token: address (token address)
   * - allocatedAmount: uint256 (amount allocated)
   * - startTimestamp: uint256 (start timestamp)
   *
   * Persistence:
   * - Calls `updateRewardsRootTx` to update the transaction hash for the rewards root
   */
  async processAllocationAddedEvent(event: EventData) {
    const decodedEvent = decodeEventLog({
      abi: EVENTS.AllocationAdded.abi,
      data: event.raw.data,
      topics: event.raw.topics,
    });

    const root = decodedEvent.args.root;
    const rootHashBytes = hexToBytes(root);

    const updatedRoot = await this.#rewardsRepository.updateRewardsRootTx(
      rootHashBytes,
      event.transactionHash,
    );

    if (updatedRoot) {
      this.#logger.info(
        `Updated rewards root tx for root ${root} to ${event.transactionHash}`,
      );
    } else {
      this.#logger.warn(
        `No rewards root found to update for root ${root} (tx: ${event.transactionHash})`,
      );
    }
  }

  /**
   * Highest block number already persisted to `indexing_events`.
   *
   * Used by the indexing loop to set `fromBlock = lastBlock`
   * so we resume exactly where we left off after restarts.
   */
  lastBlockNumber(): Promise<bigint> {
    return this.#eventsRepository.lastBlockNumber();
  }
}
