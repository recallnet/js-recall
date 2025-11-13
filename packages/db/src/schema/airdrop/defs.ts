import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { tokenAmount } from "../custom-types.js";

export const seasons = pgTable("seasons", {
  id: serial().primaryKey().notNull(),
  number: integer().notNull().unique(),
  name: text().notNull().unique(),
  startDate: timestamp({ withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp({ withTimezone: true }),
});

// Main table for storing airdrop allocations data
export const airdropAllocations = pgTable(
  "airdrop_allocations",
  {
    address: varchar("address", { length: 42 }).primaryKey().notNull(),
    // Allocation amount as string to handle large numbers
    amount: tokenAmount("amount").notNull(), // Max uint256 as string
    season: integer("season")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    // Merkle proof stored as JSON array
    proof: text("proof").notNull(), // JSON array of hex strings
    // Optional category for allocation classification
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
