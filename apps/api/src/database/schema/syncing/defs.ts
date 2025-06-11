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
 * Tracks S3 objects that need to be synchronized to the Recall Testnet
 */
export const objectIndex = pgTable(
  "object_index",
  {
    id: uuid().primaryKey().notNull(),
    objectKey: text("object_key").notNull(),
    bucketName: varchar("bucket_name", { length: 255 }).notNull(),
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    dataType: varchar("data_type", { length: 100 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    contentHash: varchar("content_hash", { length: 255 }),
    metadata: jsonb(),
    eventTimestamp: timestamp("event_timestamp", { withTimezone: true }),
    objectLastModifiedAt: timestamp("object_last_modified_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint on object key
    unique("object_index_object_key_key").on(table.objectKey),
    // Indexes for synchronizer queries
    index("idx_object_index_competition_id").on(table.competitionId),
    index("idx_object_index_agent_id").on(table.agentId),
    index("idx_object_index_data_type").on(table.dataType),
    index("idx_object_index_object_last_modified_at").on(
      table.objectLastModifiedAt,
    ),
    index("idx_object_index_competition_modified").on(
      table.competitionId,
      table.objectLastModifiedAt,
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