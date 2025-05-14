import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const teams = pgTable(
  "teams",
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 100 }).notNull(),
    contactPerson: varchar("contact_person", { length: 100 }).notNull(),
    apiKey: varchar("api_key", { length: 400 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    bucketAddresses: text("bucket_addresses").array(),
    imageUrl: text(),
    metadata: jsonb(),
    isAdmin: boolean("is_admin").default(false),
    active: boolean().default(false),
    deactivationReason: text("deactivation_reason"),
    deactivationDate: timestamp("deactivation_date", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    index("idx_teams_active").on(table.active),
    index("idx_teams_api_key").on(table.apiKey),
    index("idx_teams_is_admin").on(table.isAdmin),
    index("idx_teams_metadata_ref_name").using(
      "btree",
      sql`(((metadata -> 'ref'::text) ->> 'name'::text))`,
    ),
    unique("teams_email_key").on(table.email),
    unique("teams_api_key_key").on(table.apiKey),
    unique("teams_wallet_address_key").on(table.walletAddress),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    externalLink: text(),
    imageUrl: text(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: varchar({ length: 20 }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [index("idx_competitions_status").on(table.status)],
);

export const competitionTeams = pgTable(
  "competition_teams",
  {
    competitionId: uuid("competition_id").notNull(),
    teamId: uuid("team_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_teams_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "competition_teams_team_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.competitionId, table.teamId],
      name: "competition_teams_pkey",
    }),
  ],
);
