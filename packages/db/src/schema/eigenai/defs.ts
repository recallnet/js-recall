import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitions } from "../core/defs.js";

/**
 * EigenAI schema for verifiable inference badge tracking.
 *
 * Design principles:
 * - Modular: completely separate from core schema
 * - Badge-based: indicator only, not a participation requirement
 * - No enforcement: agents without badge can still compete
 */
export const eigenaiSchema = pgSchema("eigenai");

/**
 * Verification status for a signature submission
 */
export const verificationStatus = eigenaiSchema.enum("verification_status", [
  "verified",
  "invalid",
  "pending",
]);

/**
 * eigenai.signature_submissions
 *
 * Immutable log of all EigenAI signature submissions from agents.
 *
 * Stores raw signature data for verification audit trail. Each submission
 * represents one EigenAI API call by the agent. Rows are append-only
 * (never updated after initial insert).
 *
 * Data stored enables signature re-verification:
 * - message = chainId + responseModel + requestPrompt + responseOutput
 * - viem.recoverMessageAddress(message, signature) === expectedSigner
 */
export const signatureSubmissions = eigenaiSchema.table(
  "signature_submissions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    /** Agent who submitted the signature */
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),

    /** Competition context for the submission */
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),

    /** 65-byte hex signature from EigenAI response */
    signature: text("signature").notNull(),

    /** Chain ID used in message reconstruction (e.g., "1" for mainnet) */
    chainId: text("chain_id").notNull(),

    /** Concatenated prompt content from all request messages */
    requestPrompt: text("request_prompt").notNull(),

    /** Model ID from EigenAI response (e.g., "gpt-oss-120b-f16") */
    responseModel: text("response_model").notNull(),

    /** Full output content from EigenAI response */
    responseOutput: text("response_output").notNull(),

    /** Result of cryptographic signature verification */
    verificationStatus: verificationStatus("verification_status").notNull(),

    /** When the agent submitted this to Recall */
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),

    /** Record creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Prevent duplicate signature submissions within a competition
    // Same signature can only be submitted once per competition
    uniqueIndex("idx_sig_submissions_comp_signature_uniq").on(
      table.competitionId,
      table.signature,
    ),

    // Primary query: count verified submissions per agent/competition in time window
    index("idx_sig_submissions_agent_comp_status_submitted").on(
      table.agentId,
      table.competitionId,
      table.verificationStatus,
      table.submittedAt,
    ),

    // Query by agent across competitions
    index("idx_sig_submissions_agent_id").on(table.agentId),

    // Query by competition for stats
    index("idx_sig_submissions_competition_id").on(table.competitionId),

    // Query by submission time for badge refresh
    index("idx_sig_submissions_submitted_at").on(table.submittedAt),
  ],
);

/**
 * eigenai.agent_badge_status
 *
 * Materialized badge state per agent/competition.
 *
 * Stores computed badge status for fast lookups. Refreshed periodically
 * by cron job based on signature_submissions data. One row per
 * (agent_id, competition_id) pair.
 */
export const agentBadgeStatus = eigenaiSchema.table(
  "agent_badge_status",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    /** Agent whose badge status this tracks */
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),

    /** Competition context for badge status */
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),

    /** Whether the agent currently has an active EigenAI badge */
    isBadgeActive: boolean("is_badge_active").notNull().default(false),

    /** Count of verified signatures in the last 24 hours */
    signaturesLast24h: integer("signatures_last_24h").notNull().default(0),

    /** Timestamp of most recent verified signature submission */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    /** When this status was last recalculated */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Record creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Enforce one status per (agent, competition) pair
    uniqueIndex("idx_badge_status_agent_competition_uniq").on(
      table.agentId,
      table.competitionId,
    ),

    // Query active badges for leaderboard display
    index("idx_badge_status_competition_active").on(
      table.competitionId,
      sql`${table.isBadgeActive} DESC`,
    ),

    // Query by agent for profile display
    index("idx_badge_status_agent_id").on(table.agentId),

    // Query by competition for stats
    index("idx_badge_status_competition_id").on(table.competitionId),

    // Query for stale records during refresh
    index("idx_badge_status_updated_at").on(table.updatedAt),
  ],
);
