import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { tokenAmount } from "../custom-types.js";

// Main table for storing airdrop claims data
export const airdropClaims = pgTable(
  "airdrop_claims",
  {
    address: varchar("address", { length: 42 }).primaryKey().notNull(),
    // Claim amount as string to handle large numbers
    amount: tokenAmount("amount").notNull(), // Max uint256 as string
    season: integer("season").notNull(),
    // Merkle proof stored as JSON array
    proof: text("proof").notNull(), // JSON array of hex strings
    // Optional category for claim classification
    category: varchar("category", { length: 255 }).default(""),
    // Sybil classification: 'approved', 'maybe-sybil', 'sybil'
    sybilClassification: varchar("sybil_classification", { length: 20 })
      .default("approved")
      .notNull(),
    flaggedAt: timestamp("flagged_at", { withTimezone: true }),
    flaggingReason: text("flagging_reason"),
    // Eligibility flags for breakdown categories
    powerUser: boolean("power_user").default(false).notNull(),
    recallSnapper: boolean("recall_snapper").default(false).notNull(),
    aiBuilder: boolean("ai_builder").default(false).notNull(),
    aiExplorer: boolean("ai_explorer").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for common query patterns
    index("idx_sybil_classification").on(table.sybilClassification),
    index("idx_season").on(table.season),
    index("idx_amount").on(table.amount),
    index("idx_address_lower").on(table.address),
  ],
);

// Metadata table for merkle tree information
export const merkleMetadata = pgTable("merkle_metadata", {
  id: integer("id").primaryKey().default(1), // Single row table
  merkleRoot: varchar("merkle_root", { length: 66 }).notNull(),
  totalAmount: varchar("total_amount", { length: 78 }).notNull(),
  totalRows: integer("total_rows").notNull(),
  uniqueAddresses: integer("unique_addresses").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Optional: Table for tracking claim status (if needed for future)
export const claimStatus = pgTable(
  "claim_status",
  {
    address: varchar("address", { length: 42 }).primaryKey().notNull(),
    claimed: boolean("claimed").default(false).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    transactionHash: varchar("transaction_hash", { length: 66 }),
    stakingDuration: integer("staking_duration"), // In days
    stakedAmount: varchar("staked_amount", { length: 78 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_claimed").on(table.claimed),
    index("idx_claimed_at").on(table.claimedAt),
  ],
);
