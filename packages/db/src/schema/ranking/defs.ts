import {
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, arenas, competitionType, competitions } from "../core/defs.js";

/**
 * Stores the current agent rank for an agent
 *
 * Supports both global rankings (arena_id IS NULL) and arena-specific rankings (arena_id IS NOT NULL):
 * - Global: One score per (agent, type) where arena_id IS NULL
 * - Arena: One score per (agent, arena) where arena_id IS NOT NULL
 */
export const agentScore = pgTable(
  "agent_score",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    type: competitionType("type").default("trading").notNull(),
    arenaId: text("arena_id"), // nullable - NULL for global rankings, populated for arena-specific
    mu: doublePrecision("mu").notNull(),
    sigma: doublePrecision("sigma").notNull(),
    ordinal: doublePrecision("ordinal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_score_agent_id").on(table.agentId),
    index("idx_agent_score_ordinal").on(table.ordinal),
    index("idx_agent_score_type").on(table.type),
    index("idx_agent_score_arena_id").on(table.arenaId),

    // Partial unique constraints for global vs arena scores (handled by migration 0060):
    // - unique_agent_score_global: ensures one global score per (agent_id, type) where arena_id IS NULL
    // - unique_agent_score_arena: ensures one arena score per (agent_id, arena_id) where arena_id IS NOT NULL

    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_score_agent_id_fkey",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.arenaId],
      foreignColumns: [arenas.id],
      name: "agent_score_arena_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * Stores the history of every agent rank score after each competition
 */
export const agentScoreHistory = pgTable(
  "agent_score_history",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    type: competitionType("type").default("trading").notNull(),
    mu: doublePrecision("mu").notNull(),
    sigma: doublePrecision("sigma").notNull(),
    ordinal: doublePrecision("ordinal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_score_history_agent_id").on(table.agentId),
    index("idx_agent_score_history_competition_id").on(table.competitionId),
    index("idx_agent_score_history_agent_competition").on(
      table.agentId,
      table.competitionId,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_score_history_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "agent_score_history_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);
