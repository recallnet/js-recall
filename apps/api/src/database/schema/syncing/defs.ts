import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agents, competitions } from "@/database/schema/core/defs.js";

/**
 * Stores competition data that needs to be synchronized to the Recall Testnet
 */
export const objectIndex = pgTable(
  "object_index",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    dataType: varchar("data_type", { length: 100 }).notNull(),
    data: text("data").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    metadata: jsonb(),
    eventTimestamp: timestamp("event_timestamp", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for synchronizer queries
    index("idx_object_index_competition_id").on(table.competitionId),
    index("idx_object_index_agent_id").on(table.agentId),
    index("idx_object_index_data_type").on(table.dataType),
    index("idx_object_index_competition_agent").on(
      table.competitionId,
      table.agentId,
    ),
    // Foreign keys
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "object_index_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "object_index_agent_id_fkey",
    }).onDelete("cascade"),
  ],
);
