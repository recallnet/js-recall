import {
  foreignKey,
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitions } from "@/database/schema/core/defs.js";

/**
 * Stores the current agent rank for an agent
 */
export const agentRank = pgTable(
  "agent_rank",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    mu: numeric("mu", { precision: 6, scale: 2, mode: "number" }).notNull(),
    sigma: numeric("sigma", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_rank_agent_id").on(table.agentId),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_rank_agent_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * Stores the history of every agent rank score after each competition
 */
export const agentRankHistory = pgTable(
  "agent_rank_history",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    mu: numeric("mu", { precision: 6, scale: 2, mode: "number" }).notNull(),
    sigma: numeric("sigma", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_rank_history_agent_id").on(table.agentId),
    index("idx_agent_rank_history_competition_id").on(table.competitionId),
    index("idx_agent_rank_history_agent_competition").on(
      table.agentId,
      table.competitionId,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_rank_history_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "agent_rank_history_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);
