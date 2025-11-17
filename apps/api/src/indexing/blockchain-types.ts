/**
 * Raw log shape as returned by an RPC / Hypersync client before normalization.
 *
 * Notes:
 * - Values may arrive as hex strings or numbers (`blockNumber`, `blockTimestamp`).
 * - `topics[0]` is always the event signature (topic0).
 * - Other fields may be missing depending on provider / subscription mode.
 *
 * This type is only used transiently inside the indexer pipeline
 * before conversion into the normalized `EventData` model.
 */
export type RawLog = {
  address: `0x${string}`;
  blockNumber?: string | number;
  blockHash?: string;
  blockTimestamp?: string | number;
  transactionHash?: string;
  logIndex?: number;
  topics: [signature: `0x${string}`, ...args: `0x${string}`[]];
  data: `0x${string}`;
};

/**
 * Normalized event data structure used by our indexer.
 *
 * Purpose:
 * - Converts a `RawLog` into a consistent, strongly-typed record.
 *
 * Fields:
 * - blockNumber / blockHash / blockTimestamp: canonical chain coordinates.
 * - transactionHash / logIndex: unique identifier within the block.
 * - raw: untouched payload (topics + data + address) for re-decoding or audits.
 * - type: internal event type (`stake` / `unstake` / …).
 * - createdAt: indexer ingestion timestamp (when _we_ created the entry).
 */
export type EventData = {
  // Blockchain metadata (stored immediately during indexing)
  blockNumber: bigint;
  blockHash: string;
  blockTimestamp: Date;
  transactionHash: string;
  logIndex: number;
  // Raw event payload (stored without parsing)
  raw: {
    topics: [signature: `0x${string}`, ...args: `0x${string}`[]];
    data: `0x${string}`;
    address: `0x${string}`;
  };
  type: EventType;
  // Indexer metadata
  createdAt: Date;
};

/**
 * Known blockchain event categories.
 *
 * - "stake"    → Stake(staker, tokenId, amount, startTime, lockupEndTime)
 * - "unstake"  → Unstake(staker, tokenId, amountToUnstake, withdrawAllowedTime)
 * - "relock"   → Relock(staker, tokenId, updatedOldStakeAmount)
 * - "withdraw" → Withdraw(staker, tokenId, amount)
 * - "rewardClaimed" → RewardClaimed(root, user, amount)
 * - "allocationAdded" → AllocationAdded(root, token, allocatedAmount, startTimestamp)
 * - "unknown"  → Fallback when topic0 doesn't match our ABI set.
 *
 * This is the discriminator used throughout the indexer / DB schema.
 */
export type EventType =
  | "stake"
  | "unstake"
  | "relock"
  | "withdraw"
  | "rewardClaimed"
  | "allocationAdded"
  | "unknown";
