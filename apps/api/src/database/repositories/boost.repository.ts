import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { db } from "@/database/db.js";
import * as schema from "@/database/schema/voting/defs.js";
import { BlockchainAddressAsU8A } from "@/lib/coders.js";

export { BoostRepository, BoostChangeMetaSchema };
export type { BoostDiffArgs, BoostDiffResult, BoostChangeMeta };

/** Schema of an optional structured context to attach to each boost change. */
const BoostChangeMetaSchema = z.object({
  description: z.string().optional(),
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
  /** EVM address; will be lowercased before persisting. */
  wallet: string;
  /**
   * Amount to apply:
   * - `increase`: must be >= 0n
   * - `decrease`: must be  > 0n (debited amount)
   */
  amount: bigint;
  /** Optional metadata persisted with the journal row. */
  meta?: BoostChangeMeta;
  /**
   * Idempotency key (unique per wallet).
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
  | { changeId: string; balanceAfter: bigint; idemKey: Uint8Array } // change applied
  | { balance: bigint; idemKey: Uint8Array }; // noop (already applied)

/**
 * BoostRepository
 *
 * Off-chain accounting for the "Boost"s.
 * Tables (see schema/voting/defs.ts):
 *  - boost_balances: current mutable balance per wallet (CHECK balance >= 0)
 *  - boost_changes: immutable append-only journal of deltas with an idempotency key
 *
 * Core ideas:
 *  - **Idempotency** via (wallet, idem_key). Repeating the same logical operation
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
 *      `crypto.randomUUID()`. Use only if you don’t need to dedupe retries.
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
  readonly #db: typeof db;

  constructor(database: typeof db = db) {
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
  increase(args: BoostDiffArgs): Promise<BoostDiffResult> {
    const amount = args.amount;
    if (amount < 0n) {
      throw new Error("amount must be non-negative");
    }
    const idemKey = args.idemKey ?? randomBytes(32);
    const wallet = BlockchainAddressAsU8A.encode(args.wallet);
    const meta = args.meta || DEFAULT_META;

    return this.#db.transaction(async (tx) => {
      let balanceRow: { balance: bigint };
      const [inserted] = await tx
        .insert(schema.boostBalances)
        .values({
          wallet: wallet,
          balance: 0n,
        })
        .onConflictDoNothing({
          target: [schema.boostBalances.wallet],
        })
        .returning({ balance: schema.boostBalances.balance });
      if (inserted) {
        balanceRow = inserted;
      } else {
        const [selected] = await tx
          .select({ balance: schema.boostBalances.balance })
          .from(schema.boostBalances)
          .where(eq(schema.boostBalances.wallet, wallet))
          .limit(1)
          .for("update");
        if (!selected) {
          // Impossible situation if we prohibit deletion
          throw new Error(
            "Can neither INSERT nor SELECT for for boost_balances table",
          );
        }
        balanceRow = selected;
      }
      // 1) Try to record the change (idempotent via (wallet, idem_key))
      const [insertedChange] = await tx
        .insert(schema.boostChanges)
        .values({
          id: crypto.randomUUID(),
          wallet,
          deltaAmount: amount,
          meta,
          idemKey,
        })
        .onConflictDoNothing({
          target: [schema.boostChanges.wallet, schema.boostChanges.idemKey],
        })
        .returning({ id: schema.boostChanges.id });

      if (insertedChange) {
        // 2) First time we see this idemKey → increment (or create) balance
        const [updated] = await tx
          .insert(schema.boostBalances)
          .values({
            wallet: wallet,
            balance: amount,
          })
          .onConflictDoUpdate({
            target: [schema.boostBalances.wallet],
            set: {
              balance: sql`${schema.boostBalances.balance} + excluded.${schema.boostBalances.balance}`,
              updatedAt: sql`now()`,
            },
          })
          .returning({
            balance: schema.boostBalances.balance,
          });

        return {
          balanceAfter: updated!.balance,
          changeId: insertedChange.id,
          idemKey: idemKey,
        };
      } else {
        // Already applied earlier: do NOT touch balance, just return the current value
        return {
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
  decrease(args: BoostDiffArgs): Promise<BoostDiffResult> {
    const amount = args.amount;
    if (amount <= 0n) {
      throw new Error("amount must be positive");
    }
    const idemKey = args.idemKey ?? randomBytes(32);
    const wallet = BlockchainAddressAsU8A.encode(args.wallet);
    const meta = args.meta || DEFAULT_META;

    return this.#db.transaction(async (tx) => {
      // 1) Lock the wallet balance row if it exists
      const [balanceRow] = await tx
        .select({ balance: schema.boostBalances.balance })
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.wallet, wallet))
        .for("update"); // locks this row until tx ends
      if (!balanceRow) {
        throw new Error("Can not decrease balance of non-existent wallet");
      }
      const currentBalance = balanceRow.balance;
      if (currentBalance < amount) {
        throw new Error("Can not decrease balance below zero");
      }
      // 2) Lock the (wallet, idemKey) change row if it exists
      const [existing] = await tx
        .select({ id: schema.boostChanges.id })
        .from(schema.boostChanges)
        .where(
          and(
            eq(schema.boostChanges.wallet, wallet),
            eq(schema.boostChanges.idemKey, idemKey),
          ),
        )
        .for("update"); // locks the change row if present
      if (existing) {
        // already applied
        return {
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
        .where(eq(schema.boostBalances.wallet, wallet))
        .returning({ balance: schema.boostBalances.balance });

      if (!updatedRow) {
        throw new Error(`Can not decrease balance for wallet ${wallet}`);
      }

      // 4) Record the change (unique (wallet, idem_key) prevents dupes)
      const [change] = await tx
        .insert(schema.boostChanges)
        .values({
          id: crypto.randomUUID(),
          wallet: wallet,
          deltaAmount: -amount,
          meta,
          idemKey,
        })
        .onConflictDoNothing({
          target: [schema.boostChanges.wallet, schema.boostChanges.idemKey],
        })
        .returning({ id: schema.boostChanges.id });

      if (!change) {
        throw new Error(
          `Can not add change for wallet ${wallet} and delta -${amount}`,
        );
      }

      return {
        changeId: change.id,
        balanceAfter: updatedRow.balance,
        idemKey,
      };
    });
  }
}
