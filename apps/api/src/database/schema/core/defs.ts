import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  ACTOR_STATUS_VALUES,
  COMPETITION_STATUS_VALUES,
  COMPETITION_TYPE_VALUES,
} from "@/types/index.js";

/**
 * Statuses for users, agents, and admins.
 */
export const actorStatus = pgEnum("actor_status", ACTOR_STATUS_VALUES);

/**
 * Defines the possible statuses for competitions.
 */
export const competitionStatus = pgEnum(
  "competition_status",
  COMPETITION_STATUS_VALUES,
);

/**
 * Defines the possible types for competitions.
 */
export const competitionType = pgEnum(
  "competition_type",
  COMPETITION_TYPE_VALUES,
);

/**
 * Users represent the human owners of agents
 */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).unique().notNull(),
    name: varchar({ length: 100 }),
    email: varchar({ length: 100 }).unique(),
    imageUrl: text("image_url"),
    metadata: jsonb(),
    status: actorStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_users_wallet_address").on(table.walletAddress),
    index("idx_users_status").on(table.status),
    unique("users_wallet_address_key").on(table.walletAddress),
  ],
);

/**
 * Agents are AI entities owned by users that participate in competitions
 */
export const agents = pgTable(
  "agents",
  {
    id: uuid().primaryKey().notNull(),
    ownerId: uuid("owner_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).unique(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 100 }).unique(),
    description: text(),
    imageUrl: text("image_url"),
    apiKey: varchar("api_key", { length: 400 }).notNull(),
    metadata: jsonb(),
    status: actorStatus("status").default("active").notNull(),
    deactivationReason: text("deactivation_reason"),
    deactivationDate: timestamp("deactivation_date", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agents_owner_id").on(table.ownerId),
    index("idx_agents_status").on(table.status),
    index("idx_agents_wallet_address").on(table.walletAddress),
    index("idx_agents_api_key").on(table.apiKey),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "agents_owner_id_fkey",
    }).onDelete("cascade"),
    unique("agents_owner_id_name_key").on(table.ownerId, table.name),
    unique("agents_api_key_key").on(table.apiKey),
    unique("agents_wallet_address_key").on(table.walletAddress),
  ],
);

/**
 * Admins manage the system and competitions
 */
export const admins = pgTable(
  "admins",
  {
    id: uuid().primaryKey().notNull(),
    username: varchar({ length: 50 }).unique().notNull(),
    email: varchar({ length: 100 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    apiKey: varchar("api_key", { length: 400 }).unique(),
    name: varchar({ length: 100 }),
    imageUrl: text("image_url"),
    metadata: jsonb(),
    status: actorStatus("status").default("active").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_admins_username").on(table.username),
    index("idx_admins_email").on(table.email),
    index("idx_admins_api_key").on(table.apiKey),
    index("idx_admins_status").on(table.status),
    unique("admins_username_key").on(table.username),
    unique("admins_email_key").on(table.email),
    unique("admins_api_key_key").on(table.apiKey),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    type: competitionType("type").default("trading").notNull(),
    externalUrl: text("external_url"),
    imageUrl: text("image_url"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: competitionStatus("status").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [index("idx_competitions_status").on(table.status)],
);

/**
 * Junction table for agent participation in competitions
 */
export const competitionAgents = pgTable(
  "competition_agents",
  {
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_agents_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "competition_agents_agent_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.competitionId, table.agentId],
      name: "competition_agents_pkey",
    }),
  ],
);

export const agentNonces = pgTable(
  "agent_nonces",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    nonce: varchar("nonce", { length: 100 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_agent_nonces_agent_id").on(table.agentId),
    index("idx_agent_nonces_nonce").on(table.nonce),
    index("idx_agent_nonces_expires_at").on(table.expiresAt),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "agent_nonces_agent_id_fkey",
    }).onDelete("cascade"),
  ],
);
