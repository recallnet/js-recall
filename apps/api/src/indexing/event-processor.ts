import type { Logger } from "pino";
import { decodeEventLog } from "viem";

import { EVENTS } from "@/indexing/blockchain-events-config.js";
import type { EventData } from "@/indexing/blockchain-types.js";
import type { EventsRepository } from "@/indexing/events.repository.js";
import type { StakesRepository } from "@/indexing/stakes.repository.js";

export { EventProcessor };

class EventProcessor {
  readonly #eventsRepository: EventsRepository;
  readonly #stakesRepository: StakesRepository;
  readonly #logger: Logger;

  constructor(
    eventsRepository: EventsRepository,
    stakesRepository: StakesRepository,
    logger: Logger,
  ) {
    this.#eventsRepository = eventsRepository;
    this.#stakesRepository = stakesRepository;
    this.#logger = logger;
  }

  async processEvent(event: EventData, eventName: string) {
    // Step 1: Check if event already exists (to avoid reprocessing)
    const isEventPresent = await this.#eventsRepository.isEventPresent(
      event.blockNumber,
      event.transactionHash,
      event.logIndex,
    );
    // FIXME Last Start fromBlock from events
    if (isEventPresent) {
      this.#logger.warn(
        `Event already exists, skipping: ${event.transactionHash}...`,
      );
      return true;
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
    const isEventAdded = await this.#eventsRepository.save(event);
    if (isEventAdded) {
      this.#logger.info(
        `Blockchain event added to database: ${event.transactionHash}`,
      );
    }
    this.#logger.info(
      `Successfully processed ${event.type} event (tx: ${event.transactionHash})`,
    );
    return true;
  }

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
    const isStakeAdded = await this.#stakesRepository.stake({
      stakeId: tokenId,
      wallet: staker,
      amount: amount,
      duration: duration,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      blockTimestamp: event.blockTimestamp,
      txHash: event.transactionHash,
      logIndex: event.logIndex,
    });
    if (isStakeAdded) {
      this.#logger.info(
        `Staked ${amount} tokens for ${staker} at ${event.blockNumber} (${event.transactionHash})`,
      );
    }
  }

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
      amountUnstaked: amountUnstaked,
      canWithdrawAfter: canWithdrawAfter,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      blockTimestamp: event.blockTimestamp,
      txHash: event.transactionHash,
      logIndex: event.logIndex,
    });
  }

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

  lastBlockNumber(): Promise<bigint> {
    return this.#eventsRepository.lastBlockNumber();
  }
}
