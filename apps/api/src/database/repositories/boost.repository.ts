import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/database/db.js";
import * as schema from "@/database/schema/voting/defs.js";

export { BoostRepository, BoostChangeMetaSchema };
export type { BoostDiffArgs, BoostDiffResult };

const BoostChangeMetaSchema = z.object({
  description: z.string().optional(),
});
type BoostChangeMeta = z.infer<typeof BoostChangeMetaSchema>;
const DEFAULT_META: BoostChangeMeta = {};

type BoostDiffArgs = {
  wallet: string;
  amount: bigint;
  meta?: BoostChangeMeta;
  idemKey?: string;
};

type BoostDiffResult =
  | { changeId: string; balanceAfter: bigint; idemKey: string } // change applied
  | { balance: bigint; idemKey: string }; // no changes

class BoostRepository {
  readonly #db: typeof db;

  constructor(database: typeof db = db) {
    this.#db = database;
  }

  increase(args: BoostDiffArgs): Promise<BoostDiffResult> {
    const amount = args.amount;
    if (amount < 0n) {
      throw new Error("amount must be non-negative");
    }
    const idemKey = args.idemKey ?? crypto.randomUUID();
    const wallet = args.wallet.toLowerCase();
    const meta = args.meta || DEFAULT_META;

    return this.#db.transaction(async (tx) => {
      // 1) Try to record the change (idempotent via (wallet, idem_key))
      const [change] = await tx
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

      if (change) {
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
          changeId: change.id,
          idemKey: idemKey,
        };
      } else {
        // Already applied earlier: do NOT touch balance, just return current value
        const [row] = await tx
          .select({ balance: schema.boostBalances.balance })
          .from(schema.boostBalances)
          .where(eq(schema.boostBalances.wallet, wallet))
          .limit(1);

        return {
          balance: row?.balance ?? 0n,
          idemKey: idemKey,
        };
      }
    });
  }

  decrease(args: BoostDiffArgs): Promise<BoostDiffResult> {
    const amount = args.amount;
    if (amount <= 0n) {
      throw new Error("amount must be non-negative");
    }
    const idemKey = args.idemKey ?? crypto.randomUUID();
    const wallet = args.wallet.toLowerCase();
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
