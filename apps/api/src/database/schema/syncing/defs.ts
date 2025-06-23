import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitions } from "@/database/schema/core/defs.js";
import { SYNC_DATA_TYPE_VALUES } from "@/types/index.js";

/**
 * Sync data type enum for postgres
 */
export const syncDataType = pgEnum("sync_data_type", SYNC_DATA_TYPE_VALUES);

/**
 * Stores competition data that needs to be synchronized to the Recall Testnet
 */
export const objectIndex = pgTable(
  "object_index",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id"),
    agentId: uuid("agent_id"),
    dataType: syncDataType("data_type").notNull(),
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
    index("idx_object_index_created_at").on(table.createdAt),
    // Foreign keys
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "object_index_competition_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "object_index_agent_id_fkey",
    }).onDelete("set null"),
  ],
);
