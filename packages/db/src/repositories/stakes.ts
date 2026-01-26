import { and, asc, eq, getTableColumns, gt, isNull, sql } from "drizzle-orm";
import { Logger } from "pino";

import {
  BlockHashCoder,
  BlockchainAddressAsU8A,
  TxHashCoder,
} from "../coders/index.js";
import * as schema from "../schema/indexing/defs.js";
import type { StakeRow } from "../schema/indexing/types.js";
import { Database, Transaction } from "../types.js";

export { StakesRepository };
export type { Tx, StakeArgs, UnstakeArgs, RelockArgs, WithdrawArgs };

/**
 * Common blockchain metadata attached to all stake lifecycle events.
 * These fields uniquely identify the on-chain log and preserve ordering.
 */
type Tx = {
  /** timestamp of the block this event was included in. */
  blockTimestamp: Date;
  /** Transaction hash (lowercased before DB insert). */
  txHash: string;
  /** Log index inside the transaction’s receipt (unique with txHash). */
  logIndex: number;
  /** Block number on chain (bigint for safety). */
  blockNumber: bigint;
  /** Block hash (lowercased before DB insert). */
  blockHash: string;
};

/**
 * Arguments for handling a Stake event (creation of a new stake position).
 */
type StakeArgs = {
  /** On-chain stake/receipt ID (NFT token id). */
  stakeId: bigint;
  /** Staker’s EVM wallet address. */
  wallet: string;
  /** Amount of tokens initially staked (U256 integer, no decimals). */
  amount: bigint;
  /** Lockup duration in seconds (used to compute canUnstakeAfter). */
  duration: number;
} & Tx;

/**
 * Arguments for handling an Unstake event (reduces or fully ends a stake position).
 */
type UnstakeArgs = {
  /** On-chain stake/receipt ID being unstaked. */
  stakeId: bigint;
  /**
   * Remaining active amount after this unstake.
   * Example:
   *   If previous = 100 and 30 is unstaked, then remainingAmount = 70.
   */
  remainingAmount: bigint;
  /**
   * Chain-enforced UTC unlock time when withdrawal becomes possible.
   * Derived from withdrawAllowedTime in the event.
   */
  canWithdrawAfter: Date;
} & Tx;

/**
 * Arguments for handling a Relock event (moving unstaked funds back into lockup).
 */
type RelockArgs = {
  /** On-chain stake/receipt ID being relocked. */
  stakeId: bigint;
  /**
   * New active amount after relock:
   * - 0 → full relock (entire stake closed and then reissued as a separate Stake event)
   * - >0 → partial relock (some funds carried forward)
   */
  updatedAmount: bigint;
} & Tx;

/**
 * Arguments for handling a Withdraw event (terminal lifecycle step).
 */
type WithdrawArgs = {
  /** On-chain stake/receipt ID being withdrawn. */
  stakeId: bigint;
} & Tx;

/**
 * StakesRepository
 *
 * Owns mutations of the **stake state machine** and its immutable journal:
 * - `stakes` (current mutable snapshot; one row per on-chain stake id)
 * - `stake_changes` (append-only ledger of applied deltas with chain coords)
 *
 * Responsibilities / guarantees:
 * - **Atomicity:** Every state change to `stakes` is written in the **same DB transaction**
 *   as its corresponding `stake_changes` row.
 * - **Idempotency at the service layer:** Callers should guard with the unique
 *   `(tx_hash, log_index)` constraint (done in EventProcessor/EventsRepository).
 * - **Normalization:** Wallets / hashes are lowercased on write.
 * - **Concurrency control:** Optimistic guards (e.g., `eq(stakes.amount, prev)`)
 *   and row locks where needed prevent lost updates.
 *
 * Lifecyle semantics:
 * - Stake → (optional) Unstake (partial/full) → (optional) Relock or Withdraw.
 * - `withdrawnAt` and `relockedAt` are terminal and mutually exclusive.
 *
 * Extending:
 * - Add new lifecycle methods here and ensure each mutates `stakes` + appends to
 *   `stake_changes` together.
 */
class StakesRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Create a new stake row (if not already present) and journal the delta.
   *
   * Writes:
   * - `stakes`: inserts a row keyed by on-chain `stakeId`, initializing lifecycle fields.
   * - `stake_changes`: delta +amount, kind "stake", with chain coordinates.
   *
   * Idempotency:
   * - Uses `onConflictDoNothing()` on `stakes` so repeated stake events do not duplicate.
   *   (Event uniqueness should still be enforced at a higher level on `(tx_hash, log_index)`.)
   *
   * Returns:
   * - `StakeRow` if a new `stakes` row was inserted (first time we saw this stake id).
   * - `undefined` if it already existed (no journal row is written in that case).
   */
  stake(args: StakeArgs, tx?: Transaction): Promise<StakeRow | undefined> {
    const wallet = BlockchainAddressAsU8A.encode(args.wallet);
    const walletAddress = args.wallet.toLowerCase();
    const executor = tx || this.#db;
    return executor.transaction(async (tx) => {
      const [stake] = await tx
        .insert(schema.stakes)
        .values({
          id: args.stakeId,
          wallet: wallet,
          walletAddress,
          amount: args.amount,
          stakedAt: args.blockTimestamp,
          canUnstakeAfter: new Date(
            args.blockTimestamp.getTime() + args.duration * 1000,
          ),
          unstakedAt: null,
          canWithdrawAfter: null,
          withdrawnAt: null,
          relockedAt: null,
        })
        .onConflictDoNothing()
        .returning(getTableColumns(schema.stakes));

      if (!stake) {
        return undefined;
      }
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx
        .insert(schema.stakeChanges)
        .values({
          id: crypto.randomUUID(),
          stakeId: args.stakeId,
          wallet: wallet,
          walletAddress,
          deltaAmount: args.amount,
          kind: "stake",
          txHash: txHash,
          logIndex: args.logIndex,
          blockNumber: args.blockNumber,
          blockHash: blockHash,
          createdAt: args.blockTimestamp,
        })
        .onConflictDoNothing();
      return stake;
    });
  }

  /**
   * Lookup helper by on-chain stake id.
   *
   * Returns:
   * - The current `StakeRow` snapshot, or `undefined` if not found.
   *
   * Usage:
   * - Called by `unstake()` to decide partial vs full flows.
   */
  async findById(id: bigint, tx?: Transaction): Promise<StakeRow | undefined> {
    const db = tx || this.#db;
    const rows = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, id))
      .limit(1);
    if (rows.length > 0) {
      return rows[0];
    }
    return undefined;
  }

  /**
   * Unstake dispatcher (partial vs full).
   *
   * Behavior:
   * - Loads the current amount and routes to `partialUnstake` if
   *   `amountUnstaked < amountStaked`, otherwise `fullUnstake`.
   *
   * Notes:
   * - If the stake id doesn’t exist, this is a no-op (idempotent from caller view).
   * - Both paths must write a `stake_changes` row in the same transaction.
   */
  async unstake(args: UnstakeArgs, tx?: Transaction): Promise<void> {
    const found = await this.findById(args.stakeId, tx);
    if (!found) {
      return;
    }
    const amountStaked = found.amount;
    const remainingAmount = args.remainingAmount;
    if (remainingAmount < amountStaked) {
      // Partial Unstake
      await this.partialUnstake(args, amountStaked, tx);
    } else {
      // Full Unstake
      await this.fullUnstake(args, amountStaked, tx);
    }
  }

  /**
   * Partial unstake: reduce the active amount and set `canWithdrawAfter`.
   *
   * Writes:
   * - `stakes`: updates `amount` (should be *remaining* amount = staked - unstaked),
   *   and sets `canWithdrawAfter`.
   * - `stake_changes`: delta is negative (−amountUnstaked), kind "unstake".
   *
   * Concurrency:
   * - Guarded by `eq(stakes.amount, amountStaked)` to avoid lost updates.
   */
  async partialUnstake(
    args: UnstakeArgs,
    amountStaked: bigint,
    tx?: Transaction,
  ): Promise<void> {
    const deltaAmount = args.remainingAmount - amountStaked; // should be negative
    if (deltaAmount >= 0n) {
      throw new Error("Cannot unstake more than staked amount");
    }
    const db = tx || this.#db;
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(schema.stakes)
        .set({
          amount: args.remainingAmount,
          canWithdrawAfter: args.canWithdrawAfter,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            eq(schema.stakes.amount, amountStaked), // Concurrency Guard
          ),
        )
        .returning({
          wallet: schema.stakes.wallet,
          walletAddress: schema.stakes.walletAddress,
        });

      const wallet = rows[0]?.wallet;
      const walletAddress = rows[0]?.walletAddress;
      if (!wallet || !walletAddress) {
        this.#logger.warn(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
          },
          "partialUnstake skipped: stake not found or amount mismatch (idempotent retry)",
        );
        return;
      }
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet,
        walletAddress: walletAddress,
        deltaAmount: deltaAmount,
        kind: "unstake",
        txHash: txHash,
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: blockHash,
        createdAt: args.blockTimestamp,
      });
    });
  }

  /**
   * Full unstake: mark the stake as unstaked (no amount change) and set withdraw window.
   *
   * Writes:
   * - `stakes`: sets `unstakedAt` and `canWithdrawAfter` (amount unchanged).
   * - `stake_changes`: delta 0 (or −amount depending on your ledger semantics; here 0),
   *   kind "unstake".
   *
   * Concurrency:
   * - Guarded by `eq(stakes.amount, amountStaked)` and `isNull(stakes.unstakedAt)`.
   */
  async fullUnstake(
    args: UnstakeArgs,
    amountStaked: bigint,
    tx?: Transaction,
  ): Promise<void> {
    const deltaAmount = args.remainingAmount - amountStaked; // Should be exactly 0
    if (deltaAmount !== 0n) {
      throw new Error("Should unstake exactly the staked amount");
    }
    const db = tx || this.#db;
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(schema.stakes)
        .set({
          unstakedAt: args.blockTimestamp,
          canWithdrawAfter: args.canWithdrawAfter,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            eq(schema.stakes.amount, amountStaked),
            isNull(schema.stakes.unstakedAt),
          ),
        )
        .returning({
          wallet: schema.stakes.wallet,
          walletAddress: schema.stakes.walletAddress,
        });
      const wallet = rows[0]?.wallet;
      const walletAddress = rows[0]?.walletAddress;
      if (!wallet || !walletAddress) {
        this.#logger.warn(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
          },
          "fullUnstake skipped: stake not found or already unstaked (idempotent retry)",
        );
        return;
      }
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet,
        walletAddress: walletAddress,
        deltaAmount: deltaAmount,
        kind: "unstake",
        txHash: txHash,
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: blockHash,
        createdAt: args.blockTimestamp,
      });
    });
  }

  /**
   * Relock dispatcher (full vs partial).
   *
   * Behavior:
   * - Full relock: updatedAmount == 0n (close out active amount).
   * - Partial relock: updatedAmount > 0n (reduce active amount to updatedAmount).
   */
  async relock(args: RelockArgs, tx?: Transaction): Promise<void> {
    const updatedAmount = args.updatedAmount;
    if (updatedAmount == 0n) {
      // Full Relock
      await this.fullRelock(args, tx);
    } else {
      // Partial Relock
      await this.partialRelock(args, tx);
    }
  }

  /**
   * Full relock: both `relockedAt` and `unstakedAt` are set at the same block time.
   *
   * Writes:
   * - `stakes`: sets `relockedAt` and `unstakedAt` (no `amount` change here).
   * - `stake_changes`: delta −currentAmount, kind "relock" (per our chosen semantics).
   *
   * Concurrency:
   * - Requires both `relockedAt` and `unstakedAt` to be NULL prior to update.
   */
  async fullRelock(args: RelockArgs, tx?: Transaction): Promise<void> {
    if (args.updatedAmount !== 0n) {
      throw new Error("Should relock exactly the staked amount");
    }
    const db = tx || this.#db;
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.stakes)
        .set({
          relockedAt: args.blockTimestamp,
          unstakedAt: args.blockTimestamp,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            isNull(schema.stakes.relockedAt),
            isNull(schema.stakes.unstakedAt),
          ),
        )
        .returning({
          wallet: schema.stakes.wallet,
          walletAddress: schema.stakes.walletAddress,
          amount: schema.stakes.amount,
        });
      if (!row || !row.amount || !row.wallet || !row.walletAddress) {
        this.#logger.warn(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
          },
          "fullRelock skipped: stake not found or already relocked (idempotent retry)",
        );
        return;
      }
      const wallet = row.wallet;
      const walletAddress = row.walletAddress;
      const amount = row.amount;
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet,
        walletAddress: walletAddress,
        deltaAmount: -amount,
        kind: "relock",
        txHash: txHash,
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: blockHash,
        createdAt: args.blockTimestamp,
      });
    });
  }

  /**
   * Partial relock: reduce active amount to `updatedAmount` at the relock time.
   *
   * Writes:
   * - `stakes`: sets `relockedAt`, `unstakedAt`, and updates `amount = updatedAmount`.
   * - `stake_changes`: delta = (amountAfter − amountBefore), typically negative.
   *
   * Concurrency:
   * - Locks the row with `.for("update")` to read `amountBefore` safely,
   *   then enforces `relockedAt IS NULL` and `unstakedAt IS NULL` on update.
   */
  async partialRelock(args: RelockArgs, tx?: Transaction): Promise<void> {
    if (args.updatedAmount <= 0n) {
      throw new Error("Should relock non-zero amount");
    }
    const db = tx || this.#db;
    await db.transaction(async (tx) => {
      const prevRows = await tx
        .select({
          amountBefore: schema.stakes.amount,
        })
        .from(schema.stakes)
        .where(eq(schema.stakes.id, args.stakeId))
        .for("update");
      const prevRow = prevRows[0];
      if (!prevRow) {
        this.#logger.warn(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
          },
          "partialRelock skipped: stake not found (idempotent retry)",
        );
        return;
      }
      const amountBefore = prevRow.amountBefore;

      const [row] = await tx
        .update(schema.stakes)
        .set({
          relockedAt: args.blockTimestamp,
          unstakedAt: args.blockTimestamp,
          amount: args.updatedAmount,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            isNull(schema.stakes.relockedAt),
            isNull(schema.stakes.unstakedAt),
          ),
        )
        .returning({
          wallet: schema.stakes.wallet,
          walletAddress: schema.stakes.walletAddress,
          amount: schema.stakes.amount,
        });
      if (!row) {
        // Row was locked but update failed - this indicates the stake was already
        // relocked (idempotent retry) or a serious DB inconsistency
        this.#logger.error(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
            amountBefore: amountBefore.toString(),
          },
          "partialRelock: impossible state - row locked but update failed (likely idempotent retry or DB issue)",
        );
        return;
      }
      const wallet = row.wallet;
      const walletAddress = row.walletAddress;
      const amountAfter = row.amount;
      const delta = amountAfter - amountBefore; // should be negative
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet,
        walletAddress: walletAddress,
        deltaAmount: delta,
        kind: "relock",
        txHash: txHash,
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: blockHash,
        createdAt: args.blockTimestamp,
      });
    });
  }

  /**
   * Withdraw: terminal transition; sets `withdrawnAt`.
   *
   * Writes:
   * - `stakes`: sets `withdrawnAt` (must be NULL beforehand).
   * - `stake_changes`: delta 0 (pure status change) or negative if your ledger
   *   treats withdrawal as a balance delta; here 0.
   *
   * Concurrency:
   * - Guarded by `isNull(stakes.withdrawnAt)`.
   */
  async withdraw(args: WithdrawArgs, tx?: Transaction): Promise<void> {
    const db = tx || this.#db;
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.stakes)
        .set({
          withdrawnAt: args.blockTimestamp,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            isNull(schema.stakes.withdrawnAt),
          ),
        )
        .returning({
          wallet: schema.stakes.wallet,
          walletAddress: schema.stakes.walletAddress,
        });
      if (!row) {
        this.#logger.warn(
          {
            stakeId: args.stakeId.toString(),
            txHash: args.txHash,
            logIndex: args.logIndex,
          },
          "withdraw skipped: stake not found or already withdrawn (idempotent retry)",
        );
        return;
      }
      const wallet = row.wallet;
      const walletAddress = row.walletAddress;
      const txHash = TxHashCoder.encode(args.txHash);
      const blockHash = BlockHashCoder.encode(args.blockHash);
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet,
        walletAddress: walletAddress,
        deltaAmount: 0n,
        kind: "withdraw",
        txHash: txHash,
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: blockHash,
        createdAt: args.blockTimestamp,
      });
    });
  }

  async allStaked(
    afterId?: bigint,
    limit: number = 100,
  ): Promise<Array<StakeRow>> {
    let condition;
    if (afterId) {
      condition = and(
        gt(schema.stakes.id, afterId),
        isNull(schema.stakes.unstakedAt),
      );
    } else {
      condition = isNull(schema.stakes.unstakedAt);
    }
    return this.#db
      .select()
      .from(schema.stakes)
      .where(condition)
      .orderBy(asc(schema.stakes.id))
      .limit(limit);
  }

  async allStakedByWallet(
    wallet: string,
    tx?: Transaction,
  ): Promise<Array<StakeRow>> {
    const walletAddress = wallet.toLowerCase();
    const executor = tx ?? this.#db;
    return executor
      .select()
      .from(schema.stakes)
      .where(
        and(
          eq(schema.stakes.walletAddress, walletAddress),
          isNull(schema.stakes.unstakedAt),
        ),
      )
      .orderBy(asc(schema.stakes.id));
  }

  /**
   * Get the total sum of all active stakes for a wallet.
   *
   * Returns:
   * - The sum of all stake amounts where `unstakedAt` is NULL for the given wallet.
   * - Returns 0n if no active stakes are found.
   *
   * @param wallet - The wallet address to query
   * @param tx - Optional transaction context
   * @returns Promise<bigint> - The total sum of active stakes
   */
  async getTotalStakedByWallet(
    wallet: string,
    tx?: Transaction,
  ): Promise<bigint> {
    const walletAddress = wallet.toLowerCase();
    const executor = tx ?? this.#db;

    const result = await executor
      .select({
        total: sql`sum(${schema.stakes.amount})`.mapWith(BigInt).as("total"),
      })
      .from(schema.stakes)
      .where(
        and(
          eq(schema.stakes.walletAddress, walletAddress),
          isNull(schema.stakes.unstakedAt),
        ),
      );

    return result[0]?.total ?? 0n;
  }
}
