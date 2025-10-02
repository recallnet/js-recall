import {
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitionType, competitions } from "../core/defs.js";

/**
 * Stores the current agent rank for an agent
 */
export const agentScore = pgTable(
  "agent_score",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    type: competitionType("type").default("trading").notNull(),
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
    unique("unique_agent_score_agent_id").on(table.agentId),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_score_agent_id_fkey",
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
