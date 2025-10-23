import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bytea } from "../custom-types.js";

/**
 * Conviction Claims table
 *
 * Stores conviction claim data from the conviction claims contract.
 * Data is decoded from transaction input to capture stake duration.
 * Each row represents a single claim where a user claimed tokens with a specific stake duration.
 *
 * Indexed by:
 * - account (for user queries)
 * - season (for filtering by season)
 * - blockNumber (for chronological ordering)
 * - transactionHash for uniqueness
 */
export const convictionClaims = pgTable(
  "conviction_claims",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Claim data
    account: text("account").notNull(), // Address that claimed
    eligibleAmount: numeric("eligible_amount", {
      precision: 78,
      scale: 0,
      mode: "bigint",
    }).notNull(),
    claimedAmount: numeric("claimed_amount", {
      precision: 78,
      scale: 0,
      mode: "bigint",
    }).notNull(),
    season: integer("season").notNull(), // Season number (0, 1, 2, etc.)
    duration: bigint("duration", { mode: "bigint" }), // Stake duration in seconds

    // Blockchain metadata
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp", {
      withTimezone: false,
    }).notNull(),
    transactionHash: bytea("transaction_hash").notNull(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Indexes for efficient querying
    accountIdx: index("conviction_claims_account_idx").on(table.account),
    seasonIdx: index("conviction_claims_season_idx").on(table.season),
    blockNumberIdx: index("conviction_claims_block_number_idx").on(
      table.blockNumber,
    ),

    // Unique constraint to prevent duplicate processing
    uniqueTxIdx: uniqueIndex("conviction_claims_tx_hash_unique").on(
      table.transactionHash,
    ),
  }),
);

export type ConvictionClaim = typeof convictionClaims.$inferSelect;
export type NewConvictionClaim = typeof convictionClaims.$inferInsert;
