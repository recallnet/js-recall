import type { Logger } from "pino";
import { decodeEventLog } from "viem";

import { db } from "@/database/db.js";
import { EVENTS } from "@/indexing/blockchain-events-config.js";
import type { EventData } from "@/indexing/blockchain-types.js";
import type { EventsRepository } from "@/indexing/events.repository.js";
import type { StakesRepository } from "@/indexing/stakes.repository.js";
import { BlockchainAddressAsU8A } from "@/lib/coders.js";
import { BoostAwardService } from "@/services/boost-award.service.js";
import { CompetitionManager } from "@/services/index.js";

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
  readonly #eventsRepository: EventsRepository;
  readonly #stakesRepository: StakesRepository;
  readonly #logger: Logger;
  readonly #boostAwardService: BoostAwardService;
  readonly #competitionManager: CompetitionManager;
  readonly #db: typeof db;

  constructor(
    database: typeof db,
    eventsRepository: EventsRepository,
    stakesRepository: StakesRepository,
    boostAwardService: BoostAwardService,
    competitionManager: CompetitionManager,
    logger: Logger,
  ) {
    this.#db = database;
    this.#eventsRepository = eventsRepository;
    this.#stakesRepository = stakesRepository;
    this.#boostAwardService = boostAwardService;
    this.#competitionManager = competitionManager;
    this.#logger = logger;
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
    const wallet = BlockchainAddressAsU8A.encode(staker);
    const amount = decodedEvent.args.amount;
    const stakedAt = Math.floor(event.blockTimestamp.getTime() / 1000); // seconds;
    const lockupEndTime = Number(decodedEvent.args.lockupEndTime); // seconds;
    const duration = lockupEndTime - stakedAt;
    const isStakeAdded = await this.#db.transaction(async (tx) => {
      const stake = await this.#stakesRepository.stake(
        {
          stakeId: tokenId,
          wallet: wallet,
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
        const competition =
          await this.#competitionManager.getActiveCompetition();
        if (
          competition &&
          competition.votingStartDate &&
          competition.votingEndDate
        ) {
          await this.#boostAwardService.awardForStake(
            {
              id: tokenId,
              wallet: wallet,
              amount: amount,
              stakedAt: stake.stakedAt,
              canUnstakeAfter: stake.canUnstakeAfter,
            },
            {
              id: competition.id,
              votingStartDate: competition.votingStartDate,
              votingEndDate: competition.votingEndDate,
            },
            tx,
          );
        }
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
   * Highest block number already persisted to `indexing_events`.
   *
   * Used by the indexing loop to set `fromBlock = lastBlock`
   * so we resume exactly where we left off after restarts.
   */
  lastBlockNumber(): Promise<bigint> {
    return this.#eventsRepository.lastBlockNumber();
  }
}
