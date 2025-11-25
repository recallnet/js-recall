import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { tokenAmount } from "../custom-types.js";

export const MAX_HANDLE_LENGTH = 15;

/**
 * User metadata stored in the metadata JSONB field
 */
export type UserMetadata = {
  website?: string;
};

/**
 * Statuses for users, agents, and admins.
 */
export const actorStatus = pgEnum("actor_status", [
  "active",
  "inactive",
  "suspended",
  "deleted",
]);

/**
 * Defines the possible statuses for competitions.
 */
export const competitionStatus = pgEnum("competition_status", [
  "pending",
  "active",
  "ending",
  "ended",
]);

/**
 * Defines the possible types for competitions.
 */
export const competitionType = pgEnum("competition_type", [
  "trading",
  "perpetual_futures",
  "sports_prediction",
]);

/**
 * Defines the possible engine types
 */
export const engineType = pgEnum("engine_type", [
  "spot_paper_trading",
  "perpetual_futures",
  "spot_live_trading",
]);

/**
 * Defines the possible allocation units for rewards
 */
export const allocationUnit = pgEnum("allocation_unit", [
  "RECALL",
  "USDC",
  "USD",
]);

/**
 * Defines the possible display states for competitions
 */
export const displayState = pgEnum("display_state", [
  "active",
  "waitlist",
  "cancelled",
  "pending",
  "paused",
]);

/**
 * Defines the possible statuses for agents within competitions.
 */
export const competitionAgentStatus = pgEnum("competition_agent_status", [
  "active",
  "withdrawn",
  "disqualified",
]);

/**
 * Users represent the human owners of agents
 */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).unique().notNull(),
    // Note: only tracked for the `walletAddress` column since embedded wallets are guaranteed
    walletLastVerifiedAt: timestamp("wallet_last_verified_at", {
      withTimezone: true,
    }),
    // TODO: Privy data (email, privy ID, & embedded wallet address) are nullable since legacy
    // users are not guaranteed to have these. In the future, we can choose to remove users who
    // are missing these or have no "last login" data.
    //
    // Legacy users always have custom (non-embedded) linked wallets (e.g., metamask), but new
    // users might not link one and rely on embedded wallets. So, we maintain the "existing"
    // `walletAddress` column to track whether the user has connected a custom wallet, and we
    // also add a new `embeddedWalletAddress` column for the Privy-generated wallet.
    //
    // For any new user, we initially set these as the same value—optionally, letting a user
    // link a custom wallet. For any legacy user, we keep their `walletAddress` and prompt them
    // to link their custom wallet to Privy account (within UI flows).
    embeddedWalletAddress: varchar("embedded_wallet_address", {
      length: 42,
    }).unique(),
    privyId: text("privy_id").unique(),
    name: varchar({ length: 100 }),
    email: varchar({ length: 100 }).unique(),
    isSubscribed: boolean("is_subscribed").notNull().default(false),
    imageUrl: text("image_url"),
    metadata: jsonb().$type<UserMetadata>(),
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
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_users_wallet_address").on(table.walletAddress),
    index("idx_users_privy_id").on(table.privyId),
    index("idx_users_status").on(table.status),
    unique("users_wallet_address_key").on(table.walletAddress),
  ],
);

/**
 * User wallets are either embedded wallets via Privy or custom wallets linked by the user
 *
 * TODO: this table is not used yet, but will be used in the future to track user wallets.
 * For example, we need a way to distinguish between a linked browser wallet since a user
 * will likely want this as their "primary" and rewards-related address.
 */
// export const userWallets = pgTable(
//   "user_wallets",
//   {
//     id: uuid().primaryKey().notNull(),
//     userId: uuid("user_id").notNull(),
//     address: varchar("address", { length: 42 }).notNull(),
//     isPrimary: boolean("is_primary").notNull().default(false),
//     isEmbeddedWallet: boolean("is_embedded_wallet").notNull().default(false),
//     clientType: varchar("client_type", { length: 100 }), // Free form via Privy API (e.g. "privy", "metamask", etc.)
//     lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
//     createdAt: timestamp("created_at", { withTimezone: true })
//       .defaultNow()
//       .notNull(),
//     updatedAt: timestamp("updated_at", { withTimezone: true })
//       .defaultNow()
//       .notNull(),
//   },
//   (table) => [
//     // One primary wallet per user (optional; partial unique)
//     unique("wallets_one_primary_per_user").on(table.userId, table.isPrimary),
//     // Fast lookups
//     index("wallets_user_id").on(table.userId),
//     index("wallets_user_id_primary").on(table.userId, table.isPrimary),
//     foreignKey({
//       columns: [table.userId],
//       foreignColumns: [users.id],
//       name: "user_wallets_user_id_fkey",
//     }).onDelete("cascade"),
//     unique("user_wallets_address_key").on(table.address),
//   ],
// );

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
    handle: varchar({ length: MAX_HANDLE_LENGTH }).notNull(),
    email: varchar({ length: 100 }).unique(),
    description: text(),
    imageUrl: text("image_url"),
    apiKey: varchar("api_key", { length: 400 }).notNull(),
    apiKeyHash: varchar("api_key_hash", { length: 64 }),
    metadata: jsonb(),
    status: actorStatus("status").default("active").notNull(),
    deactivationReason: text("deactivation_reason"),
    deactivationDate: timestamp("deactivation_date", {
      withTimezone: true,
    }),
    isRewardsIneligible: boolean("is_rewards_ineligible")
      .default(false)
      .notNull(),
    rewardsIneligibilityReason: text("rewards_ineligibility_reason"),
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
    index("idx_agents_handle").on(table.handle),
    index("idx_agents_api_key").on(table.apiKey),
    index("idx_agents_api_key_hash").on(table.apiKeyHash),
    index("idx_agents_rewards_ineligible").on(table.isRewardsIneligible),
    // NOTE: There is an extra index not listed here. There is a GIN index on the "name" that is
    // created via custom migration (0038_left_ultragirl) due to Drizzle limitations. That index
    // supports case-insensitive queries on agent names.
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "agents_owner_id_fkey",
    }).onDelete("cascade"),
    unique("agents_owner_id_name_key").on(table.ownerId, table.name),
    unique("agents_handle_key").on(table.handle),
    unique("agents_api_key_key").on(table.apiKey),
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

/**
 * Arenas are grouping mechanisms for organizing related competitions
 * Stores metadata and classification for discovery/filtering
 */
export const arenas = pgTable(
  "arenas",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    createdBy: text("created_by"),
    category: text().notNull(),
    skill: text().notNull(),
    venues: text().array(),
    chains: text().array(),
    kind: text().default("Competition").notNull(),
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
    index("idx_arenas_id").on(table.id),
    index("idx_arenas_category").on(table.category),
    index("idx_arenas_skill").on(table.skill),
    unique("arenas_id_key").on(table.id),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid().primaryKey().notNull(),
    arenaId: text("arena_id"),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    type: competitionType("type").default("trading").notNull(),
    externalUrl: text("external_url"),
    imageUrl: text("image_url"),

    // Schedule
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    boostStartDate: timestamp("boost_start_date", { withTimezone: true }),
    boostEndDate: timestamp("boost_end_date", { withTimezone: true }),
    joinStartDate: timestamp("join_start_date", { withTimezone: true }),
    joinEndDate: timestamp("join_end_date", { withTimezone: true }),
    maxParticipants: integer("max_participants"),
    registeredParticipants: integer("registered_participants")
      .default(0)
      .notNull(),
    minimumStake: numeric("minimum_stake", {
      precision: 30,
      scale: 15,
      mode: "number",
    }),
    vips: text("vips").array(),
    allowlist: text("allowlist").array(),
    blocklist: text("blocklist").array(),
    minRecallRank: integer("min_recall_rank"),
    allowlistOnly: boolean("allowlist_only").default(false),

    agentAllocation: numeric("agent_allocation", {
      precision: 30,
      scale: 15,
      mode: "number",
    }),
    agentAllocationUnit: allocationUnit("agent_allocation_unit"),
    boosterAllocation: numeric("booster_allocation", {
      precision: 30,
      scale: 15,
      mode: "number",
    }),
    boosterAllocationUnit: allocationUnit("booster_allocation_unit"),
    rewardRules: text("reward_rules"),
    rewardDetails: text("reward_details"),
    rewardsIneligible: text("rewards_ineligible").array(),
    boostTimeDecayRate: numeric("boost_time_decay_rate", {
      precision: 5,
      scale: 4,
      mode: "number",
    }),

    // Engine routing
    engineId: engineType("engine_id"),
    engineVersion: text("engine_version"),

    // Display
    status: competitionStatus("status").notNull(),
    sandboxMode: boolean("sandbox_mode").notNull().default(false),
    displayState: displayState("display_state"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.arenaId],
      foreignColumns: [arenas.id],
      name: "competitions_arena_id_fkey",
    }).onDelete("set null"),
    index("idx_competitions_arena_id").on(table.arenaId),
    index("idx_competitions_status").on(table.status),
    index("idx_competitions_id_participants").on(
      table.id,
      table.registeredParticipants,
      table.maxParticipants,
    ),
    index("idx_competitions_status_type_id").on(
      table.status,
      table.type,
      table.id,
    ),
    index("idx_competitions_status_end_date").on(table.status, table.endDate),
    index("idx_competitions_engine_id").on(table.engineId),
  ],
);

/**
 * Master partner information
 * Stores partner details that can be reused across multiple competitions
 */
export const partners = pgTable(
  "partners",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    url: text("url"),
    logoUrl: text("logo_url"),
    details: text("details"),
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
  (table) => [index("idx_partners_name").on(table.name)],
);

/**
 * Junction table linking partners to competitions
 * Tracks which partners are associated with which competitions and display ordering
 */
export const competitionPartners = pgTable(
  "competition_partners",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    partnerId: uuid("partner_id").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_partners_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.partnerId],
      foreignColumns: [partners.id],
      name: "competition_partners_partner_id_fkey",
    }).onDelete("cascade"),
    unique("competition_partners_competition_id_partner_id_key").on(
      table.competitionId,
      table.partnerId,
    ),
    unique("competition_partners_competition_id_position_key").on(
      table.competitionId,
      table.position,
    ),
    index("idx_competition_partners_competition_id").on(table.competitionId),
    index("idx_competition_partners_partner_id").on(table.partnerId),
  ],
);

/**
 * Tracks agent participation in competitions
 * Stores agent status, deactivation reason, and timestamps per competition
 */
export const competitionAgents = pgTable(
  "competition_agents",
  {
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    // note: this is the agent status in regard to the competition
    status: competitionAgentStatus("status").default("active").notNull(),
    deactivationReason: text("deactivation_reason"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
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
    // Add indexes for performance
    index("idx_competition_agents_status").on(table.status),
    index("idx_competition_agents_competition_id").on(table.competitionId),
    index("idx_competition_agents_agent_id").on(table.agentId),
    index("idx_competition_agents_deactivated_at").on(table.deactivatedAt),
    index("idx_competition_agents_competition_status").on(
      table.competitionId,
      table.status,
    ),
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

/**
 * Stores competitions final leaderboard results when it ends
 */
export const competitionsLeaderboard = pgTable(
  "competitions_leaderboard",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    rank: integer("rank").notNull(),
    totalAgents: integer("total_agents").notNull().default(0),
    score: numeric("score", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_competitions_leaderboard_agent_id").on(table.agentId),
    index("idx_competitions_leaderboard_competition_id").on(
      table.competitionId,
    ),
    index("idx_competitions_leaderboard_agent_competition").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_competitions_leaderboard_competition_rank").on(
      table.competitionId,
      table.rank,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "competitions_leaderboard_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competitions_leaderboard_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * Rewards for top agents in a competition
 * TODO: deprecate after TGE
 */
export const competitionRewards = pgTable(
  "competition_rewards",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id").notNull(),
    rank: integer("rank").notNull(),
    reward: integer("reward").notNull(),
    agentId: uuid("agent_id"), // Note: nullable since upon creation, the agent ranking is unknown
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_rewards_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "competition_rewards_agent_id_fkey",
    }).onDelete("set null"),
    unique("competition_rewards_competition_id_rank_key").on(
      table.competitionId,
      table.rank,
    ),
    index("idx_competition_rewards_competition_id").on(table.competitionId),
    index("idx_competition_rewards_agent_id").on(table.agentId),
  ],
);

/**
 * Competition prize pools
 */
export const competitionPrizePools = pgTable(
  "competition_prize_pools",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id").notNull(),
    agentPool: tokenAmount("agent_pool").notNull(),
    userPool: tokenAmount("user_pool").notNull(),
  },
  (table) => [
    unique("competition_prize_pools_competition_id_key").on(
      table.competitionId,
    ),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
    }),
  ],
);
