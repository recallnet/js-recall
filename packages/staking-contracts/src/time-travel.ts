// ABOUTME: Provides time manipulation utilities for Anvil/local blockchain testing.
// ABOUTME: Enables advancing block time and mining blocks for time-based contract testing.
import {
  type Chain,
  type PublicClient,
  type TestClient,
  type Transport,
  createPublicClient,
  createTestClient,
  http,
} from "viem";
import { foundry } from "viem/chains";

/**
 * Configuration options for the TimeTravel client
 */
export interface TimeTravelConfig {
  /** RPC URL for the Anvil instance (default: http://localhost:8545) */
  rpcUrl?: string;
  /** Chain configuration (default: foundry) */
  chain?: Chain;
}

/**
 * Result of a time travel operation
 */
export interface TimeTravelResult {
  /** The new block timestamp after the operation */
  timestamp: number;
  /** The new block number after the operation */
  blockNumber: bigint;
}

/**
 * Client for manipulating blockchain time on Anvil/local networks.
 * Useful for testing time-based contract features like staking periods.
 */
export class TimeTravel {
  private testClient: TestClient<"anvil", Transport, Chain>;
  private publicClient: PublicClient<Transport, Chain>;

  constructor(config: TimeTravelConfig = {}) {
    const rpcUrl = config.rpcUrl ?? "http://localhost:8545";
    const chain = config.chain ?? foundry;

    this.testClient = createTestClient({
      mode: "anvil",
      chain,
      transport: http(rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Advance blockchain time by a specified number of seconds
   * @param seconds Number of seconds to advance (must be non-negative)
   * @returns The new block timestamp and number
   */
  async increaseTime(seconds: number): Promise<TimeTravelResult> {
    if (seconds < 0) {
      throw new Error(
        "TimeTravel.increaseTime: 'seconds' must be non-negative.",
      );
    }
    await this.testClient.increaseTime({ seconds });
    await this.testClient.mine({ blocks: 1 });
    return this.getCurrentBlock();
  }

  /**
   * Set the timestamp for the next block
   * @param timestamp Unix timestamp to set
   * @returns The new block timestamp and number after mining
   */
  async setNextBlockTimestamp(timestamp: number): Promise<TimeTravelResult> {
    await this.testClient.setNextBlockTimestamp({
      timestamp: BigInt(timestamp),
    });
    await this.testClient.mine({ blocks: 1 });
    return this.getCurrentBlock();
  }

  /**
   * Mine a specified number of blocks
   * @param blocks Number of blocks to mine (default: 1). Must be a positive integer.
   * @returns The new block timestamp and number
   */
  async mine(blocks: number = 1): Promise<TimeTravelResult> {
    if (!Number.isFinite(blocks) || !Number.isInteger(blocks) || blocks <= 0) {
      throw new Error(`blocks must be a positive integer, received: ${blocks}`);
    }
    await this.testClient.mine({ blocks });
    return this.getCurrentBlock();
  }

  /**
   * Get the current block timestamp and number
   * @returns Current block info
   */
  async getCurrentBlock(): Promise<TimeTravelResult> {
    const block = await this.publicClient.getBlock();
    return {
      timestamp: Number(block.timestamp),
      blockNumber: block.number,
    };
  }

  /**
   * Advance time to a specific date
   * @param date Target date to advance to
   * @returns The new block timestamp and number
   */
  async advanceToDate(date: Date): Promise<TimeTravelResult> {
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    return this.setNextBlockTimestamp(targetTimestamp);
  }

  /**
   * Advance time by a specified duration
   * @param duration Object with optional days, hours, minutes, seconds
   * @returns The new block timestamp and number
   */
  async advanceBy(duration: {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
  }): Promise<TimeTravelResult> {
    const totalSeconds =
      (duration.days ?? 0) * 86400 +
      (duration.hours ?? 0) * 3600 +
      (duration.minutes ?? 0) * 60 +
      (duration.seconds ?? 0);

    if (totalSeconds < 0) {
      throw new RangeError(
        "advanceBy duration components must be non-negative; resulting totalSeconds was negative.",
      );
    }
    return this.increaseTime(totalSeconds);
  }

  /**
   * Create a snapshot of the current blockchain state
   * @returns Snapshot ID that can be used to revert
   */
  async snapshot(): Promise<`0x${string}`> {
    return await this.testClient.snapshot();
  }

  /**
   * Revert to a previous snapshot
   * @param snapshotId The snapshot ID to revert to
   */
  async revert(snapshotId: `0x${string}`): Promise<void> {
    await this.testClient.revert({ id: snapshotId });
  }
}

/**
 * Create a TimeTravel instance with default configuration
 * @param rpcUrl Optional RPC URL (default: http://localhost:8545)
 * @returns TimeTravel instance
 */
export function createTimeTravel(rpcUrl?: string): TimeTravel {
  return new TimeTravel({ rpcUrl });
}
