import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/database/db.js";
import * as schema from "@/database/schema/indexing/defs.js";
import { StakeRow } from "@/database/schema/indexing/defs.js";

export { StakesRepository };

type Tx = {
  blockTimestamp: Date;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockHash: string;
};

type StakeArgs = {
  stakeId: bigint;
  wallet: string; // EVM address
  amount: bigint; // U256 token amount, no decimals
  duration: number; // Stake duration in seconds
} & Tx;

type UnstakeArgs = {
  stakeId: bigint;
  amountUnstaked: bigint;
  canWithdrawAfter: Date;
} & Tx;

type RelockArgs = {
  stakeId: bigint;
  updatedAmount: bigint;
} & Tx;

type WithdrawArgs = {
  stakeId: bigint;
} & Tx;

class StakesRepository {
  readonly #db: typeof db;
  constructor(database: typeof db = db) {
    this.#db = database;
  }

  stake(args: StakeArgs): Promise<boolean> {
    return this.#db.transaction(async (tx) => {
      const insertedRows = await tx
        .insert(schema.stakes)
        .values({
          id: args.stakeId,
          wallet: args.wallet.toLowerCase(),
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
        .returning({ id: schema.stakes.id });

      if (insertedRows.length == 0) {
        return false;
      }
      await tx
        .insert(schema.stakeChanges)
        .values({
          id: crypto.randomUUID(),
          stakeId: args.stakeId,
          wallet: args.wallet.toLowerCase(),
          deltaAmount: args.amount,
          kind: "stake",
          txHash: args.txHash.toLowerCase(),
          logIndex: args.logIndex,
          blockNumber: args.blockNumber,
          blockHash: args.blockHash.toLowerCase(),
          createdAt: args.blockTimestamp,
        })
        .onConflictDoNothing();
      return true;
    });
  }

  async findById(id: bigint): Promise<StakeRow | undefined> {
    const rows = await this.#db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, id))
      .limit(1);
    if (rows.length > 0) {
      return rows[0];
    }
    return undefined;
  }

  async unstake(args: UnstakeArgs): Promise<void> {
    const found = await this.findById(args.stakeId);
    if (!found) {
      return;
    }
    const amountStaked = found.amount;
    const amountUnstaked = args.amountUnstaked;
    if (amountUnstaked < amountStaked) {
      // Partial Unstake
      await this.partialUnstake(args, amountStaked);
    } else {
      // Full Unstake
      await this.fullUnstake(args, amountStaked);
    }
  }

  async partialUnstake(args: UnstakeArgs, amountStaked: bigint): Promise<void> {
    const deltaAmount = args.amountUnstaked - amountStaked; // should be negative
    if (deltaAmount >= 0) {
      throw new Error("Cannot unstake more than staked amount");
    }
    await this.#db.transaction(async (tx) => {
      const rows = await tx
        .update(schema.stakes)
        .set({
          amount: args.amountUnstaked,
          canWithdrawAfter: args.canWithdrawAfter,
        })
        .where(
          and(
            eq(schema.stakes.id, args.stakeId),
            eq(schema.stakes.amount, amountStaked), // Concurrency Guard
          ),
        )
        .returning({ wallet: schema.stakes.wallet });
      const wallet = rows[0]?.wallet;
      if (!wallet) {
        throw new Error("Stake not found or stale amount (concurrent update)");
      }
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet.toLowerCase(),
        deltaAmount: deltaAmount,
        kind: "stake",
        txHash: args.txHash.toLowerCase(),
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: args.blockHash.toLowerCase(),
        createdAt: args.blockTimestamp,
      });
    });
  }

  async fullUnstake(args: UnstakeArgs, amountStaked: bigint): Promise<void> {
    const deltaAmount = args.amountUnstaked - amountStaked; // Should be exactly 0
    if (deltaAmount !== 0n) {
      throw new Error("Should unstake exactly the staked amount");
    }
    await this.#db.transaction(async (tx) => {
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
        .returning({ wallet: schema.stakes.wallet });
      const wallet = rows[0]?.wallet;
      if (!wallet) {
        throw new Error("Stake not found or stale amount (concurrent update)");
      }
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet.toLowerCase(),
        deltaAmount: deltaAmount,
        kind: "unstake",
        txHash: args.txHash.toLowerCase(),
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: args.blockHash.toLowerCase(),
        createdAt: args.blockTimestamp,
      });
    });
  }

  async relock(args: RelockArgs): Promise<void> {
    const updatedAmount = args.updatedAmount;
    if (updatedAmount == 0n) {
      // Full Relock
      await this.fullRelock(args);
    } else {
      // Partial Relock
      await this.partialRelock(args);
    }
  }

  async fullRelock(args: RelockArgs) {
    if (args.updatedAmount !== 0n) {
      throw new Error("Should relock exactly the staked amount");
    }
    await this.#db.transaction(async (tx) => {
      const rows = await tx
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
          amount: schema.stakes.amount,
        });
      const wallet = rows[0]?.wallet;
      const amount = rows[0]?.amount;
      if (!wallet || !amount) {
        throw new Error("Stake not found or stale (concurrent update)");
      }
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet.toLowerCase(),
        deltaAmount: -amount,
        kind: "relock",
        txHash: args.txHash.toLowerCase(),
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: args.blockHash.toLowerCase(),
        createdAt: args.blockTimestamp,
      });
    });
  }

  async partialRelock(args: RelockArgs) {
    if (args.updatedAmount <= 0n) {
      throw new Error("Should relock non-zero amount");
    }
    await this.#db.transaction(async (tx) => {
      const prevRows = await tx
        .select({
          amountBefore: schema.stakes.amount,
        })
        .from(schema.stakes)
        .where(eq(schema.stakes.id, args.stakeId))
        .for("update");
      const prevRow = prevRows[0];
      if (!prevRow) {
        throw new Error("Stake not found or stale (concurrent update)");
      }
      const amountBefore = prevRow.amountBefore;

      const rows = await tx
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
          amount: schema.stakes.amount,
        });
      const row = rows[0];
      if (!row) {
        throw new Error("Stake not found or stale (concurrent update)");
      }
      const wallet = row.wallet;
      const amountAfter = row.amount;
      const delta = amountAfter - amountBefore; // should be negative
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet.toLowerCase(),
        deltaAmount: delta,
        kind: "relock",
        txHash: args.txHash.toLowerCase(),
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: args.blockHash.toLowerCase(),
        createdAt: args.blockTimestamp,
      });
    });
  }

  async withdraw(args: WithdrawArgs) {
    await this.#db.transaction(async (tx) => {
      const rows = await tx
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
        .returning({ wallet: schema.stakes.wallet });
      const row = rows[0];
      if (!row) {
        throw new Error("Stake not found or stale (concurrent update)");
      }
      const wallet = row.wallet;
      await tx.insert(schema.stakeChanges).values({
        id: crypto.randomUUID(),
        stakeId: args.stakeId,
        wallet: wallet.toLowerCase(),
        deltaAmount: 0n,
        kind: "withdraw",
        txHash: args.txHash.toLowerCase(),
        logIndex: args.logIndex,
        blockNumber: args.blockNumber,
        blockHash: args.blockHash.toLowerCase(),
        createdAt: args.blockTimestamp,
      });
    });
  }
}
