import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  notExists,
  sql,
  sum,
} from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { BlockchainAddressAsU8A } from "../coders/index.js";
import * as schema from "../schema/boost/defs.js";
import {
  InsertBoostBonus,
  InsertStakeBoostAward,
  SelectAgentBoost,
  SelectAgentBoostTotal,
  SelectBoostBonus,
} from "../schema/boost/types.js";
import * as coreSchema from "../schema/core/defs.js";
import { agents } from "../schema/core/defs.js";
import { stakes } from "../schema/indexing/defs.js";
import type { Transaction } from "../types.js";
import { Database } from "../types.js";

export { BoostRepository, BoostChangeMetaSchema };
export type {
  BoostDiffArgs,
  BoostDiffResult,
  BoostChangeMeta,
  BoostAgentArgs,
  BoostAgentResult,
};

/** Schema of an optional structured context to attach to each boost change. */
const BoostChangeMetaSchema = z.object({
  description: z.string().optional(),
  boostBonusId: z.string().optional(), // UUID of bonus boost that created this change
});
/** Optional structured context to attach to each boost change. */
type BoostChangeMeta = z.infer<typeof BoostChangeMetaSchema>;
const DEFAULT_META: BoostChangeMeta = {};

/**
 * Arguments for changing a wallet’s Boost balance.
 *
 * Idempotency:
 * - Provide a stable `idemKey` to make the operation retry-safe.
 *   If omitted, a random UUID is generated (non-idempotent across retries).
 */
type BoostDiffArgs = {
  /** User ID */
  userId: string;
  /** EVM address; will be lowercased before persisting. */
  wallet: string;
  /** Competition ID */
  competitionId: string;
  /**
   * Amount to apply:
   * - `increase`: must be >= 0n
   * - `decrease`: must be  > 0n (debited amount)
   */
  amount: bigint;
  /** Optional metadata persisted with the journal row. */
  meta?: BoostChangeMeta;
  /**
   * Idempotency key (unique per balance_id = (wallet, competitionId)).
   * Reusing the same key makes the call safe to retry.
   */
  idemKey?: Uint8Array;
};

/**
 * Result of an increase/decrease call.
 *
 * Two shapes:
 * - Applied: returns new balance and the created change id.
 * - Idempotent no-op: returns existing balance when the same idemKey was seen.
 */
type BoostDiffResult =
  | {
      type: "applied";
      changeId: string;
      balanceAfter: bigint;
      idemKey: Uint8Array;
    } // change applied
  | { type: "noop"; balance: bigint; idemKey: Uint8Array }; // noop (already applied)

type BoostAgentArgs = {
  userId: string;
  /** EVM address; will be lowercased before persisting. */
  wallet: string;
  agentId: string;
  /** Competition ID */
  competitionId: string;
  /**
   * Amount to apply:
   */
  amount: bigint;
  /**
   * Idempotency key (unique per balance_id = (wallet, competitionId)).
   * Reusing the same key makes the call safe to retry.
   */
  idemKey?: Uint8Array;
};

type BoostAgentResult =
  | {
      type: "applied";
      agentBoost: SelectAgentBoost;
      agentBoostTotal: SelectAgentBoostTotal;
    }
  | {
      type: "noop";
      agentBoostTotal: SelectAgentBoostTotal;
    };

type ListCompetitionBoost = {
  userId: string;
  wallet: Uint8Array;
  agentId: string;
  agentName: string;
  agentHandle: string;
  amount: bigint;
  createdAt: Date;
};

/**
 * BoostRepository
 *
 * Off-chain accounting for the "Boost"s.
 * Tables (see schema/boost/defs.ts):
 *  - boost_balances: current mutable balance per wallet (CHECK balance >= 0)
 *  - boost_changes: immutable append-only journal of deltas with an idempotency key
 *
 * Core ideas:
 *  - **Idempotency** effectively via (wallet, competitionId, idem_key) through balanceId=(wallet, competitionId). Repeating the same logical operation
 *    with the same `idemKey` will be applied at most once.
 *  - **Atomicity**: change log and balance mutation happen in a single DB transaction.
 *  - **Lowercasing**: All wallets are canonicalized to lowercase before writes.
 *
 * Common usage:
 *  - Call `increase({ wallet, amount, idemKey? })` to credit Boost.
 *  - Call `decrease({ wallet, amount, idemKey? })` to debit Boost.
 *    (Will throw if wallet doesn’t exist or if balance would go below zero.)
 *
 * Idempotency key (`idemKey`):
 * - **Why it exists: ** Distributed systems deliver duplicates (retries, redeliveries,
 *   crash-replays). `idemKey` ensures the *same logical operation* on a given wallet
 *   is applied **at most once**. We enforce this with a unique constraint on
 *   `(wallet, idem_key)` in `boost_changes`.
 *
 * - **Scope: ** The key is **per-wallet**. The same `idemKey` value can be reused
 *   for a *different* wallet without a conflict. If an operation spans multiple wallets
 *   (e.g., a transfer), use **distinct** keys per wallet-side.
 *
 * - **How to choose: **
 *   1) **Deterministic (recommended for integrators / jobs):**
 *      derive from stable inputs that uniquely represent the business action.
 *      Example pattern:
 *        `sha256("source=competitions:v1|action=award|extId=cmp#123|wallet=0xabc|amount=100")`
 *      Notes:
 *        - Include *amount* in the hash, so changing the amount will not silently
 *          no-op under the same key.
 *        - Include a stable *external id* (e.g., competition id, order id).
 *        - Keep the string ≤ 256 chars (DB column limit); hashes are safe.
 *   2) **Random (good for one-offs / non-retried calls):**
 *      `randomUUID()`. Use only if you don’t need to dedupe retries.
 *
 * - **When to reuse vs. generate new:**
 *   - **Retry the same operation?** Reuse the *same* `idemKey` (exactly-once effect).
 *   - **New logical operation, or amount changed?** Generate a **new** `idemKey`.
 *     Reusing an old key with a *different* amount will **not** apply the change
 *     (insert is skipped) by design.
 *
 * - **Client-supplied keys:** If `idemKey` comes from untrusted clients, consider
 *   namespacing or hashing server-side to prevent accidental collisions across
 *   product areas (e.g., prefix with `feature:version:`).
 *
 * - **Zero-amount changes:** Legal; they create a journal record on the first application
 *   (useful to mark events) but will not affect balance.
 *
 * - **Pitfalls to avoid:**
 *   - Don’t omit `amount` from deterministic keys if the amount can vary—otherwise
 *     later corrections will no-op.
 *   - Don’t reuse a key for a *different* business action (e.g., “award” vs “refund”).
 *     Use separate keys; if you must reverse, create a **new** key with a negative/positive
 *     delta as appropriate.
 */
class BoostRepository {
  readonly #db: Database;

  constructor(database: Database) {
    this.#db = database;
  }

  /**
   * Credit Boost to a wallet (earn).
   *
   * Behavior:
   * 1) Insert a row into `boost_changes` with (+amount, idemKey). If a row with the
   *    same (wallet, idemKey) already exists, this is an idempotent no-op.
   * 2) If the change was inserted (first time), upsert into `boost_balances`:
   *    - create row if missing
   *    - otherwise `balance = balance + amount`, `updated_at = now()`
   *
   * Idempotency:
   * - Reusing the same `idemKey` for the same wallet will not double-credit.
   *
   * Returns:
   * - `{ changeId, balanceAfter, idemKey }` when the credit was applied.
   * - `{ balance, idemKey }` when it was a prior duplicate (no balance change).
   *
   * Notes:
   * - `amount` must be `>= 0n`. Zero-amount credits will only create a journal row
   *   on first application (useful for marking events without changing balance).
   */
  async increase(
    args: BoostDiffArgs,
    tx?: Transaction,
  ): Promise<BoostDiffResult> {
    const userId = args.userId;
    const amount = args.amount;
    if (amount < 0n) {
      throw new Error("amount must be non-negative");
    }
    const idemKey = args.idemKey ?? randomBytes(32);
    const wallet = BlockchainAddressAsU8A.encode(args.wallet);
    const meta = args.meta || DEFAULT_META;
    const competitionId = args.competitionId;

    const executor = tx || this.#db;

    return executor.transaction(async (tx) => {
      let balanceRow: { id: string; balance: bigint };
      const [inserted] = await tx
        .insert(schema.boostBalances)
        .values({
          userId,
          balance: 0n,
          competitionId: competitionId,
        })
        .onConflictDoNothing({
          target: [
            schema.boostBalances.userId,
            schema.boostBalances.competitionId,
          ],
        })
        .returning({
          id: schema.boostBalances.id,
          balance: schema.boostBalances.balance,
        });
      if (inserted) {
        balanceRow = inserted;
      } else {
        const [selected] = await tx
          .select({
            id: schema.boostBalances.id,
            balance: schema.boostBalances.balance,
          })
          .from(schema.boostBalances)
          .where(
            and(
              eq(schema.boostBalances.userId, userId),
              eq(schema.boostBalances.competitionId, competitionId),
            ),
          )
          .limit(1)
          .for("update");
        if (!selected) {
          // Impossible situation if we prohibit deletion
          throw new Error(
            "Can neither INSERT nor SELECT for boost_balances table",
          );
        }
        balanceRow = selected;
      }
      // 1) Try to record the change (idempotent via (wallet, idem_key))
      const [insertedChange] = await tx
        .insert(schema.boostChanges)
        .values({
          wallet,
          balanceId: balanceRow.id,
          deltaAmount: amount,
          meta,
          idemKey,
        })
        .onConflictDoNothing({
          target: [schema.boostChanges.balanceId, schema.boostChanges.idemKey],
        })
        .returning({ id: schema.boostChanges.id });

      if (insertedChange) {
        // 2) First time we see this idemKey → increment (or create) balance
        const [updated] = await tx
          .insert(schema.boostBalances)
          .values({
            userId,
            balance: amount,
            competitionId: competitionId,
          })
          .onConflictDoUpdate({
            target: [
              schema.boostBalances.userId,
              schema.boostBalances.competitionId,
            ],
            set: {
              balance: sql`${schema.boostBalances.balance} + excluded.balance`,
              updatedAt: sql`now()`,
            },
          })
          .returning({
            balance: schema.boostBalances.balance,
          });

        return {
          type: "applied",
          balanceAfter: updated!.balance,
          changeId: insertedChange.id,
          idemKey: idemKey,
        };
      } else {
        // Already applied earlier: do NOT touch balance, just return the current value
        return {
          type: "noop",
          balance: balanceRow.balance,
          idemKey: idemKey,
        };
      }
    });
  }

  /**
   * Debit Boost from a wallet (spend).
   *
   * Behavior:
   * 1) `SELECT … FOR UPDATE` the wallet’s balance row to serialize concurrent debits.
   * 2) Reject if the wallet does not exist or balance < amount (no overdrafts).
   * 3) Lock the potential change row (wallet, idemKey) with `FOR UPDATE`.
   *    - If it exists → idempotent no-op, return current balance.
   * 4) Apply the decrement and update `updated_at = now()`.
   * 5) Insert the journal row into `boost_changes` with (−amount, idemKey).
   *
   * Idempotency:
   * - Reusing the same `idemKey` for the same wallet will not double-debit.
   *
   * Returns:
   * - `{ changeId, balanceAfter, idemKey }` when the debit was applied.
   * - `{ balance, idemKey }` when it was a prior duplicate (no balance change).
   *
   * Errors:
   * - Throws if a wallet is missing (cannot spend from a non-existent account).
   * - Throws if debit brings balance below zero.
   *
   * Concurrency:
   * - Row-level locks ensure two concurrent `decrease` calls on the same wallet
   *   are serialized and preserve the non-negative balance invariant.
   */
  decrease(args: BoostDiffArgs, tx?: Transaction): Promise<BoostDiffResult> {
    const amount = args.amount;
    if (amount <= 0n) {
      throw new Error("amount must be positive");
    }
    const userId = args.userId;
    const idemKey = args.idemKey ?? randomBytes(32);
    const wallet = BlockchainAddressAsU8A.encode(args.wallet);
    const meta = args.meta || DEFAULT_META;
    const competitionId = args.competitionId;

    const executor = tx || this.#db;

    return executor.transaction(async (tx) => {
      // 1) Lock the wallet balance row if it exists
      const [balanceRow] = await tx
        .select({
          id: schema.boostBalances.id,
          balance: schema.boostBalances.balance,
        })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, userId),
            eq(schema.boostBalances.competitionId, competitionId),
          ),
        )
        .limit(1)
        .for("update"); // locks this row until tx ends
      if (!balanceRow) {
        // A safety net for unexpected database behavior
        throw new Error(
          `Can not decrease balance of non-existent wallet ${args.wallet} and competition ${competitionId}`,
        );
      }
      const currentBalance = balanceRow.balance;
      if (currentBalance < amount) {
        throw new Error(
          `Can not decrease balance below zero for wallet ${args.wallet} and competition ${competitionId}`,
        );
      }
      // 2) Lock the (wallet, idemKey) change row if it exists
      const [existing] = await tx
        .select({ id: schema.boostChanges.id })
        .from(schema.boostChanges)
        .where(
          and(
            eq(schema.boostChanges.balanceId, balanceRow.id),
            eq(schema.boostChanges.idemKey, idemKey),
          ),
        )
        .for("update"); // locks the change row if present
      if (existing) {
        // already applied
        return {
          type: "noop",
          balance: currentBalance,
          idemKey,
        };
      }

      // 3) Apply the decrement
      const [updatedRow] = await tx
        .update(schema.boostBalances)
        .set({
          balance: sql`${schema.boostBalances.balance} - ${amount}`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.boostBalances.userId, userId),
            eq(schema.boostBalances.competitionId, competitionId),
          ),
        )
        .returning({ balance: schema.boostBalances.balance });

      if (!updatedRow) {
        throw new Error(
          `Can not decrease balance for wallet ${args.wallet} and competition ${competitionId}`,
        );
      }

      // 4) Record the change (unique (wallet, idem_key) prevents dupes)
      const [change] = await tx
        .insert(schema.boostChanges)
        .values({
          wallet,
          balanceId: balanceRow.id,
          deltaAmount: -amount,
          meta,
          idemKey,
        })
        .onConflictDoNothing({
          target: [schema.boostChanges.balanceId, schema.boostChanges.idemKey],
        })
        .returning({ id: schema.boostChanges.id });

      if (!change) {
        throw new Error(
          `Can not add change for wallet ${args.wallet}, competition ${competitionId} and delta -${amount}`,
        );
      }

      return {
        type: "applied",
        changeId: change.id,
        balanceAfter: updatedRow.balance,
        idemKey,
      };
    });
  }

  /**
   * Retrieve the current Boost balance for a wallet in a specific competition.
   *
   * Behavior:
   * 1) Query the `boost_balances` table for the wallet and competition combination.
   * 2) Return the current balance if a record exists, otherwise return 0n.
   * 3) The wallet address is automatically lowercased before querying (consistent with other methods).
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any balances or create records.
   * - No locking is performed as this is a simple balance lookup.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - The current balance as a `bigint` (0n if no balance record exists).
   *
   * Notes:
   * - A missing balance record is treated as having a balance of 0n.
   * - This method does not create a balance record if one doesn't exist.
   * - The balance reflects the net result of all increase/decrease operations.
   *
   * @param args - The balance query parameters
   * @param args.userId - User ID whose balance to retrieve
   * @param args.competitionId - ID of the competition context
   * @param args.tx - Optional database transaction to use for the query
   * @returns Promise resolving to the current balance (0n if no record exists)
   */
  async userBoostBalance(
    {
      userId,
      competitionId,
    }: {
      userId: string;
      competitionId: string;
    },
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;
    const [res] = await executor
      .select()
      .from(schema.boostBalances)
      .where(
        and(
          eq(schema.boostBalances.userId, userId),
          eq(schema.boostBalances.competitionId, competitionId),
        ),
      )
      .limit(1);
    return res?.balance || 0n;
  }

  async agentBoostTotals(
    { competitionId }: { competitionId: string },
    tx?: Transaction,
  ): Promise<Record<string, bigint>> {
    const executor = tx || this.#db;
    const res = await executor
      .select()
      .from(schema.agentBoostTotals)
      .where(eq(schema.agentBoostTotals.competitionId, competitionId));

    const map = res.reduce<Record<string, bigint>>((acc, curr) => {
      return { ...acc, [curr.agentId]: curr.total };
    }, {});

    return map;
  }

  /**
   * Retrieve all boost totals for agents that a user has boosted in a specific competition.
   *
   * Behavior:
   * 1) Join `agent_boosts` with `boost_changes` to get the actual boost amounts.
   * 2) Group by agent ID and sum the delta amounts to get total boosts per agent.
   * 3) Transform the results into an object keyed by agent ID for efficient lookups.
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any records.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - Object with agent IDs as keys and boost totals (as bigint) as values.
   * - Empty object `{}` if the user hasn't boosted any agents in the competition.
   * - Example: `{ "agent-123": 1000n, "agent-456": 2500n }`
   *
   * Notes:
   * - The `boostTotal` is converted from string (returned by SQL SUM) to bigint using `.mapWith(BigInt)`.
   * - Only includes agents that the user has actually boosted (non-zero totals).
   * - Results are grouped by agent, so each agent appears at most once as a key.
   * - The object format allows for efficient O(1) lookups by agent ID.
   *
   * @param args - The query parameters
   * @param args.userId - ID of the user whose boosts to retrieve
   * @param args.competitionId - ID of the competition context
   * @param tx - Optional database transaction to use for the query
   * @returns Promise resolving to object mapping agent IDs to their boost totals
   */
  async userBoosts(
    { userId, competitionId }: { userId: string; competitionId: string },
    tx?: Transaction,
  ): Promise<Record<string, bigint>> {
    const executor = tx || this.#db;
    const res = await executor
      .select({
        agentId: schema.agentBoostTotals.agentId,
        boostTotal: sum(schema.boostChanges.deltaAmount).mapWith(
          (val) => BigInt(val) * -1n,
        ),
      })
      .from(schema.agentBoostTotals)
      .innerJoin(
        schema.agentBoosts,
        eq(schema.agentBoostTotals.id, schema.agentBoosts.agentBoostTotalId),
      )
      .innerJoin(
        schema.boostChanges,
        eq(schema.agentBoosts.changeId, schema.boostChanges.id),
      )
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .where(
        and(
          eq(schema.boostBalances.userId, userId),
          eq(schema.agentBoostTotals.competitionId, competitionId),
        ),
      )
      .groupBy(schema.agentBoostTotals.agentId);

    const map = res.reduce<Record<string, bigint>>((acc, curr) => {
      return { ...acc, [curr.agentId]: curr.boostTotal };
    }, {});

    return map;
  }

  /**
   * Retrieve boost changes for a specific competition, showing which agents were boosted by which users.
   *
   * Behavior:
   * 1) Join boost_changes with boost_balances to get user context.
   * 2) Join with agent_boosts to link changes to specific agents.
   * 3) Join with agent_boost_totals to get agent information.
   * 4) Filter for negative delta amounts (debits/spending) for the specified user and competition.
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any records.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - Array of boost change records showing user spending on agents.
   * - Each record includes user ID, wallet, delta amount, creation timestamp, and agent ID.
   * - Empty array if no boost spending found for the user/competition combination.
   *
   * Notes:
   * - Only returns negative delta amounts (spending/debits), not credits.
   * - Results are ordered by creation timestamp (most recent first).
   * - The wallet address is returned as stored in the database (Uint8Array format).
   *
   * @param args - The query parameters
   * @param args.competitionId - ID of the competition context
   * @param tx - Optional database transaction to use for the query
   * @returns Promise resolving to array of boost change records with agent information
   */
  async userBoostSpending(competitionId: string, tx?: Transaction) {
    const executor = tx || this.#db;
    return await executor
      .select({
        userId: schema.boostBalances.userId,
        wallet: coreSchema.users.walletAddress,
        deltaAmount: schema.boostChanges.deltaAmount,
        createdAt: schema.boostChanges.createdAt,
        agentId: schema.agentBoostTotals.agentId,
      })
      .from(schema.boostChanges)
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .innerJoin(
        coreSchema.users,
        eq(schema.boostBalances.userId, coreSchema.users.id),
      )
      .innerJoin(
        schema.agentBoosts,
        eq(schema.boostChanges.id, schema.agentBoosts.changeId),
      )
      .innerJoin(
        schema.agentBoostTotals,
        eq(schema.agentBoosts.agentBoostTotalId, schema.agentBoostTotals.id),
      )
      .where(
        and(
          eq(schema.boostBalances.competitionId, competitionId),
          sql`${schema.boostChanges.deltaAmount} < 0`,
        ),
      )
      .orderBy(schema.boostChanges.createdAt);
  }

  /**
   * Retrieve paginated boost allocations for a specific competition.
   *
   * Behavior:
   * 1) Join boost_changes with boost_balances to get user context.
   * 2) Join with agent_boosts to link changes to specific agents.
   * 3) Join with agent_boost_totals and agents to get agent information.
   * 4) Filter by competition ID.
   * 5) Order by creation timestamp descending (most recent first).
   * 6) Apply limit and offset for pagination.
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any records.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - Array of boost allocation records with user ID, wallet, agent ID, agent name, agent handle, amount (positive), and timestamp.
   * - Empty array if no boost allocations found for the competition.
   * - Amount is returned as positive bigint (negation of deltaAmount).
   * - Wallet is returned as Uint8Array (binary format from database).
   *
   * Notes:
   * - Only returns boost spending records via INNER JOIN to agent_boosts (which only contains spending).
   * - The decrease() method guarantees all agent_boosts entries have negative deltaAmount.
   * - Amounts are negated to positive values for display.
   * - Results ordered by most recent first (createdAt DESC).
   * - Supports pagination via limit and offset parameters.
   *
   * @param args - The query parameters
   * @param args.competitionId - ID of the competition context
   * @param args.limit - Maximum number of records to return
   * @param args.offset - Number of records to skip
   * @param tx - Optional database transaction to use for the query
   * @returns Promise resolving to array of boost allocation records
   */
  async competitionBoosts(
    {
      competitionId,
      limit,
      offset,
    }: { competitionId: string; limit: number; offset: number },
    tx?: Transaction,
  ): Promise<Array<ListCompetitionBoost>> {
    const executor = tx || this.#db;
    const results = await executor
      .select({
        userId: schema.boostBalances.userId,
        wallet: schema.boostChanges.wallet,
        agentId: schema.agentBoostTotals.agentId,
        agentName: agents.name,
        agentHandle: agents.handle,
        // Negate deltaAmount to convert spending records (negative) to positive display amounts.
        // Safe because WHERE clause ensures deltaAmount < 0, guaranteed by `decrease` method
        // which stores spending as -amount.
        amount: sql<bigint>`-${schema.boostChanges.deltaAmount}`.mapWith(
          BigInt,
        ),
        createdAt: schema.boostChanges.createdAt,
      })
      .from(schema.boostChanges)
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .innerJoin(
        schema.agentBoosts,
        eq(schema.boostChanges.id, schema.agentBoosts.changeId),
      )
      .innerJoin(
        schema.agentBoostTotals,
        eq(schema.agentBoosts.agentBoostTotalId, schema.agentBoostTotals.id),
      )
      .innerJoin(agents, eq(schema.agentBoostTotals.agentId, agents.id))
      .where(eq(schema.boostBalances.competitionId, competitionId))
      .orderBy(desc(schema.boostChanges.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  /**
   * Count total boost allocations for a specific competition.
   *
   * Behavior:
   * 1) Join boost_changes with boost_balances to get competition context.
   * 2) Join with agent_boosts to ensure we're counting agent allocations.
   * 3) Join with agent_boost_totals and agents (matching competitionBoosts query structure).
   * 4) Filter by competition ID.
   * 5) Return the total count.
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any records.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - Total count of boost allocation records for the competition.
   * - Returns 0 if no boost allocations found.
   *
   * Notes:
   * - Uses identical join structure as competitionBoosts() to ensure count matches returnable records.
   * - Only counts boost spending records via INNER JOIN to agent_boosts.
   * - Used for pagination to calculate total pages and hasMore flag.
   *
   * @param competitionId - ID of the competition context
   * @param tx - Optional database transaction to use for the query
   * @returns Promise resolving to total count of boost allocations
   */
  async countCompetitionBoosts(
    competitionId: string,
    tx?: Transaction,
  ): Promise<number> {
    const executor = tx || this.#db;
    const [result] = await executor
      .select({
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(schema.boostChanges)
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .innerJoin(
        schema.agentBoosts,
        eq(schema.boostChanges.id, schema.agentBoosts.changeId),
      )
      .innerJoin(
        schema.agentBoostTotals,
        eq(schema.agentBoosts.agentBoostTotalId, schema.agentBoostTotals.id),
      )
      .innerJoin(agents, eq(schema.agentBoostTotals.agentId, agents.id))
      .where(eq(schema.boostBalances.competitionId, competitionId));

    return result?.count ?? 0;
  }

  /**
   * Boost an agent by transferring Boost from a user's balance to the agent's total.
   *
   * Behavior:
   * 1) Lock the agent's boost total row if it exists to serialize concurrent boosts.
   * 2) Debit the specified amount from the user's wallet using the `decrease` method.
   *    - If the debit fails (insufficient balance, non-existent wallet), the operation fails.
   *    - If the debit is idempotent (same idemKey used before), return existing totals.
   * 3) Insert a record into `agent_boosts` linking the user, agent, and boost change.
   * 4) Upsert the agent's total boost amount in `agent_boost_totals`:
   *    - Create a new record if the agent has never been boosted in this competition.
   *    - Otherwise increment the existing total and update `updated_at`.
   *
   * Idempotency:
   * - Reusing the same `idemKey` for the same wallet will not double-boost.
   * - The underlying wallet debit uses the same idempotency mechanism as `decrease`.
   *
   * Returns:
   * - `{ agentBoost, agentBoostTotal }` when the boost was applied successfully.
   * - `{ agentBoostTotal }` when it was a prior duplicate (no balance changes).
   *
   * Errors:
   * - Throws if the user's wallet doesn't exist or has insufficient balance.
   * - Throws if database operations fail (agent boost or total insertion/update).
   *
   * Concurrency:
   * - Row-level locks on agent boost totals ensure concurrent boosts to the same agent
   *   are serialized and totals are calculated correctly.
   *
   * @param args - The boost operation parameters
   * @param args.userId - ID of the user performing the boost
   * @param args.wallet - EVM address of the user's wallet (will be lowercased)
   * @param args.agentId - ID of the agent being boosted
   * @param args.competitionId - ID of the competition context
   * @param args.amount - Amount of Boost to transfer (must be > 0n)
   * @param args.idemKey - Optional idempotency key for retry safety
   * @param tx - Optional database transaction to use
   * @returns Promise resolving to boost operation result
   */
  async boostAgent(
    { agentId, amount, competitionId, userId, wallet, idemKey }: BoostAgentArgs,
    tx?: Transaction,
  ): Promise<BoostAgentResult> {
    const executor = tx || this.#db;
    return await executor.transaction(async (tx) => {
      // First, try to decrease the user's boost balance
      const diffRes = await this.decrease(
        { userId, amount, competitionId, wallet, idemKey },
        tx,
      );

      // If it's a noop (idempotent), fetch the current total and return
      if (diffRes.type === "noop") {
        const [agentBoostTotal] = await tx
          .select()
          .from(schema.agentBoostTotals)
          .where(
            and(
              eq(schema.agentBoostTotals.agentId, agentId),
              eq(schema.agentBoostTotals.competitionId, competitionId),
            ),
          )
          .limit(1);

        if (!agentBoostTotal) {
          throw new Error(
            `Boost deduction already executed from wallet ${wallet} for competition ${competitionId}, but no agent boost total record exists for agent ${agentId}`,
          );
        }
        return {
          type: "noop",
          agentBoostTotal,
        };
      }

      // Atomically upsert the boost total
      const [updatedAgentBoostTotal] = await tx
        // first try to insert a new row, there a unique constraint on
        // compId+agentId so this will fail if the row already exists
        .insert(schema.agentBoostTotals)
        .values({
          agentId,
          competitionId,
          total: amount,
        })
        // if the row exists, atomically increment the value of `total`
        .onConflictDoUpdate({
          target: [
            schema.agentBoostTotals.agentId,
            schema.agentBoostTotals.competitionId,
          ],
          set: {
            total: sql`${schema.agentBoostTotals.total} + ${amount}`,
            updatedAt: sql`now()`,
          },
        })
        .returning();
      if (!updatedAgentBoostTotal) {
        throw new Error(
          `Failed to boost agentId ${agentId} in competition ${competitionId} by user ${userId} `,
        );
      }
      // Insert into our immutable log of boosts for agents, referencing the boost change log
      const [agentBoost] = await tx
        .insert(schema.agentBoosts)
        .values({
          agentBoostTotalId: updatedAgentBoostTotal.id,
          changeId: diffRes.changeId,
        })
        .returning();
      if (!agentBoost) {
        throw new Error(
          `Failed to boost agentId ${agentId} in competition ${competitionId} by user ${userId} `,
        );
      }
      return {
        type: "applied",
        agentBoost,
        agentBoostTotal: updatedAgentBoostTotal,
      };
    });
  }

  async recordStakeBoostAward(award: InsertStakeBoostAward, tx?: Transaction) {
    const executor = tx || this.#db;
    return await executor.transaction(async (tx) => {
      return await tx.insert(schema.stakeBoostAwards).values(award).returning();
    });
  }

  /**
   * Retrieve stakes for a wallet that haven't received boost awards for a specific competition.
   *
   * Behavior:
   * 1) Query all stakes for the specified wallet that are still active (not unstaked).
   * 2) Use NOT EXISTS subquery to filter out stakes that already have award records for the competition.
   * 3) Return only stakes that don't have corresponding stakeBoostAward records.
   *
   * Read-Only Operation:
   * - This method only reads data and does not modify any records.
   * - Safe to call concurrently with other operations.
   *
   * Returns:
   * - Array of stake records that haven't received boost awards for the specified competition.
   * - Empty array if no unawarded stakes found for the wallet/competition combination.
   *
   * Notes:
   * - Only returns active stakes (unstakedAt is null) without corresponding stakeBoostAward records.
   * - Results are ordered by stake creation timestamp (most recent first).
   * - The wallet address is encoded to Uint8Array format for database comparison.
   * - Uses NOT EXISTS subquery for efficient exclusion of already awarded stakes.
   *
   * @param wallet - EVM address of the wallet (will be encoded to Uint8Array)
   * @param competitionId - ID of the competition context
   * @param tx - Optional database transaction to use for the query
   * @returns Promise resolving to array of unawarded stake records
   */
  async unawardedStakes(
    wallet: string,
    competitionId: string,
    tx?: Transaction,
  ) {
    const executor = tx || this.#db;
    const walletAddress = wallet.toLowerCase();
    const awardsQuery = executor
      .select()
      .from(schema.stakeBoostAwards)
      .where(
        and(
          eq(schema.stakeBoostAwards.stakeId, stakes.id),
          eq(schema.stakeBoostAwards.competitionId, competitionId),
        ),
      );
    const res = await executor
      .select()
      .from(stakes)
      .where(
        and(
          eq(stakes.walletAddress, walletAddress),
          isNull(stakes.unstakedAt),
          notExists(awardsQuery),
        ),
      )
      .orderBy(desc(stakes.createdAt));
    return res;
  }

  async mergeBoost(fromUserId: string, toUserId: string, tx?: Transaction) {
    const executor = tx || this.#db;
    const res = executor.transaction(async (tx) => {
      // Find all balances for the source user
      const fromBalances = await tx
        .select()
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, fromUserId));

      const res = await Promise.all(
        fromBalances.map(async (fromBalance) => {
          // Sum up all boost changes for the source balance changes.
          // This isn't strictly necessary because we already have the current balance from the
          //  boostBalances table, but we're double-checking here that the sum of the deltas
          // matches the current balance, just to be extra defensive.
          const [fromBoostChangesSum] = await tx
            .select({
              sum: sql`sum(${schema.boostChanges.deltaAmount})`
                .mapWith(BigInt)
                .as("sum"),
            })
            .from(schema.boostChanges)
            .where(eq(schema.boostChanges.balanceId, fromBalance.id));

          if (fromBoostChangesSum?.sum !== fromBalance.balance) {
            throw new Error(
              `Boost changes sum for balance ${fromBalance.id} does not match balance amount`,
            );
          }

          // Upsert into the target user
          const [bal] = await tx
            .insert(schema.boostBalances)
            .values({
              userId: toUserId,
              balance: fromBalance.balance,
              competitionId: fromBalance.competitionId,
            })
            .onConflictDoUpdate({
              target: [
                schema.boostBalances.userId,
                schema.boostBalances.competitionId,
              ],
              set: {
                balance: sql`${schema.boostBalances.balance} + excluded.balance`,
                updatedAt: sql`now()`,
              },
            })
            .returning();
          if (!bal) {
            throw new Error(
              `Failed to merge boost for user ${toUserId} from balance ${fromBalance.id}`,
            );
          }
          // Update all changes to point to the new balance
          await tx
            .update(schema.boostChanges)
            .set({
              balanceId: bal.id,
            })
            .where(eq(schema.boostChanges.balanceId, fromBalance.id));

          // Zero out the source balance since all changes have been transferred
          await tx
            .update(schema.boostBalances)
            .set({
              balance: 0n,
              updatedAt: sql`now()`,
            })
            .where(eq(schema.boostBalances.id, fromBalance.id));

          return bal;
        }),
      );
      return res;
    });
    return res;
  }

  /**
   * Creates a new bonus boost entry.
   *
   * Multiple entries per user are allowed - amounts are summed when active.
   *
   * @param args - Bonus boost creation arguments
   * @param tx - Optional transaction
   * @returns Created bonus boost entry
   */
  async createBoostBonus(
    args: {
      userId: string;
      amount: bigint;
      expiresAt: Date;
      createdByAdminId?: string;
      meta?: Record<string, unknown>;
    },
    tx?: Transaction,
  ): Promise<SelectBoostBonus> {
    if (args.amount <= 0n) {
      throw new Error("Bonus boost amount must be greater than 0");
    }

    const executor = tx || this.#db;
    const [result] = await executor
      .insert(schema.boostBonus)
      .values({
        userId: args.userId,
        amount: args.amount,
        expiresAt: args.expiresAt,
        createdByAdminId: args.createdByAdminId ?? null,
        meta: args.meta ?? {},
      })
      .returning();
    if (!result) {
      throw new Error("Failed to create bonus boost");
    }
    return result;
  }

  /**
   * Updates an existing bonus boost entry.
   *
   * Note: The `amount` field is intentionally immutable. Once a boost is created
   * and applied to competitions, changing the amount would create data inconsistencies
   * in the audit trail. To correct an amount, revoke the boost and create a new one.
   *
   * @param id - Bonus boost ID
   * @param updates - Fields to update (amount is immutable)
   * @param tx - Optional transaction
   * @returns Updated bonus boost entry
   */
  async updateBoostBonus(
    id: string,
    updates: {
      expiresAt?: Date;
      isActive?: boolean;
      revokedAt?: Date | null;
      meta?: Record<string, unknown>;
    },
    tx?: Transaction,
  ): Promise<SelectBoostBonus> {
    const executor = tx || this.#db;

    const updateData: Partial<InsertBoostBonus> = {
      ...updates,
      updatedAt: new Date(),
    };

    const [result] = await executor
      .update(schema.boostBonus)
      .set(updateData)
      .where(eq(schema.boostBonus.id, id))
      .returning();
    if (!result) {
      throw new Error(`Bonus boost with id ${id} not found`);
    }
    return result;
  }

  /**
   * Finds all active bonus boosts for a user.
   *
   * @param userId - User ID
   * @param tx - Optional transaction
   * @returns Array of active bonus boost entries
   */
  async findActiveBoostBonusesByUserId(
    userId: string,
    tx?: Transaction,
  ): Promise<SelectBoostBonus[]> {
    const executor = tx || this.#db;
    return executor
      .select()
      .from(schema.boostBonus)
      .where(
        and(
          eq(schema.boostBonus.userId, userId),
          eq(schema.boostBonus.isActive, true),
        ),
      )
      .orderBy(desc(schema.boostBonus.createdAt));
  }

  /**
   * Finds a bonus boost by ID.
   *
   * @param id - Bonus boost ID
   * @param tx - Optional transaction
   * @returns Bonus boost entry or undefined if not found
   */
  async findBoostBonusById(
    id: string,
    tx?: Transaction,
  ): Promise<SelectBoostBonus | undefined> {
    const executor = tx || this.#db;
    const [result] = await executor
      .select()
      .from(schema.boostBonus)
      .where(eq(schema.boostBonus.id, id))
      .limit(1);
    return result;
  }

  /**
   * Finds all active bonus boosts (for cron job processing).
   *
   * @param tx - Optional transaction
   * @returns Array of all active bonus boost entries
   */
  async findAllActiveBoostBonuses(
    tx?: Transaction,
  ): Promise<SelectBoostBonus[]> {
    const executor = tx || this.#db;
    return executor
      .select()
      .from(schema.boostBonus)
      .where(eq(schema.boostBonus.isActive, true))
      .orderBy(desc(schema.boostBonus.createdAt));
  }

  /**
   * Finds users with active bonus boosts that expire after a given date.
   *
   * Used for cron job eligibility checks.
   *
   * @param beforeDate - Only return boosts that expire after this date
   * @param tx - Optional transaction
   * @returns Array of active bonus boost entries
   */
  async findUsersWithActiveBoostBonuses(
    beforeDate: Date,
    tx?: Transaction,
  ): Promise<SelectBoostBonus[]> {
    const executor = tx || this.#db;
    return executor
      .select()
      .from(schema.boostBonus)
      .where(
        and(
          eq(schema.boostBonus.isActive, true),
          gt(schema.boostBonus.expiresAt, beforeDate),
        ),
      )
      .orderBy(desc(schema.boostBonus.createdAt));
  }

  /**
   * Finds all boost_changes entries for a specific bonus boost.
   *
   * Used for revocation to find where boost was applied.
   *
   * @param boostBonusId - Bonus boost ID
   * @param tx - Optional transaction
   * @returns Array of boost_changes entries with meta.boostBonusId matching the given ID
   */
  async findBoostChangesByBoostBonusId(
    boostBonusId: string,
    tx?: Transaction,
  ): Promise<Array<{ id: string; balanceId: string; competitionId: string }>> {
    const executor = tx || this.#db;
    // Query boost_changes where meta contains boostBonusId
    // Note: This requires JSONB query - we'll need to join with boost_balances to get competitionId
    const results = await executor
      .select({
        id: schema.boostChanges.id,
        balanceId: schema.boostChanges.balanceId,
        competitionId: schema.boostBalances.competitionId,
      })
      .from(schema.boostChanges)
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .where(
        sql`${schema.boostChanges.meta}->>'boostBonusId' = ${boostBonusId}`,
      );
    return results;
  }

  /**
   * Finds all boost_changes entries for a specific competition.
   *
   * Used for cleanup when boostStartDate changes.
   *
   * @param competitionId - Competition ID
   * @param tx - Optional transaction
   * @returns Array of boost_changes entries with meta.boostBonusId
   */
  async findBoostChangesByCompetitionId(
    competitionId: string,
    tx?: Transaction,
  ): Promise<
    Array<{
      id: string;
      balanceId: string;
      meta: Record<string, unknown>;
    }>
  > {
    const executor = tx || this.#db;
    const results = await executor
      .select({
        id: schema.boostChanges.id,
        balanceId: schema.boostChanges.balanceId,
        meta: schema.boostChanges.meta,
      })
      .from(schema.boostChanges)
      .innerJoin(
        schema.boostBalances,
        eq(schema.boostChanges.balanceId, schema.boostBalances.id),
      )
      .where(
        and(
          eq(schema.boostBalances.competitionId, competitionId),
          sql`${schema.boostChanges.meta}->>'boostBonusId' IS NOT NULL`,
        ),
      );
    return results.map((r) => ({
      ...r,
      meta: r.meta as Record<string, unknown>,
    }));
  }

  /**
   * Finds multiple bonus boosts by IDs.
   *
   * @param boostBonusIds - Array of bonus boost IDs
   * @param tx - Optional transaction
   * @returns Array of bonus boost entries
   */
  async findBoostBonusesByIds(
    boostBonusIds: string[],
    tx?: Transaction,
  ): Promise<SelectBoostBonus[]> {
    if (boostBonusIds.length === 0) {
      return [];
    }
    const executor = tx || this.#db;
    return executor
      .select()
      .from(schema.boostBonus)
      .where(inArray(schema.boostBonus.id, boostBonusIds));
  }

  /**
   * Sums all active bonus boost amounts for a user.
   *
   * @param userId - User ID
   * @param tx - Optional transaction
   * @returns Sum of all active bonus boost amounts
   */
  async sumActiveBoostBonusesForUser(
    userId: string,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;
    const [result] = await executor
      .select({
        sum: sql`COALESCE(SUM(${schema.boostBonus.amount}), 0)`.mapWith(BigInt),
      })
      .from(schema.boostBonus)
      .where(
        and(
          eq(schema.boostBonus.userId, userId),
          eq(schema.boostBonus.isActive, true),
        ),
      );
    return result?.sum ?? 0n;
  }
}
