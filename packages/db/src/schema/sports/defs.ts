import {
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { agents } from "../core/defs.js";
import { competitions } from "../core/defs.js";

/**
 * Status of an NFL game
 */
export const gameStatus = pgEnum("game_status", [
  "scheduled",
  "in_progress",
  "final",
]);

/**
 * Status of a game play for prediction purposes
 */
export const playStatus = pgEnum("play_status", ["open", "locked", "resolved"]);

/**
 * Outcome of a play (run or pass)
 */
export const playOutcome = pgEnum("play_outcome", ["run", "pass"]);

/**
 * NFL games tracked for competitions
 * Stores game metadata from SportsDataIO or other providers
 */
export const games = pgTable(
  "games",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    globalGameId: integer("global_game_id").notNull().unique(), // GlobalGameID from SportsDataIO (e.g., 19068)
    gameKey: text("game_key").notNull(), // GameKey (e.g., "202510106")
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    venue: text("venue"),
    status: gameStatus("status").notNull().default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("games_global_game_id_key").on(table.globalGameId),
    index("idx_games_global_game_id").on(table.globalGameId),
    index("idx_games_game_key").on(table.gameKey),
    index("idx_games_status").on(table.status),
    index("idx_games_start_time").on(table.startTime),
  ],
);

/**
 * Individual plays within NFL games
 * Tracks play-by-play data for prediction competitions
 * Schema aligned with SportsDataIO Play-by-Play API
 */
export const gamePlays = pgTable(
  "game_plays",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    gameId: uuid("game_id").notNull(),
    providerPlayId: text("provider_play_id"), // PlayID from SportsDataIO
    sequence: integer("sequence").notNull(),
    quarterName: text("quarter_name").notNull(), // "1", "2", "3", "4", "OT"
    timeRemainingMinutes: integer("time_remaining_minutes"),
    timeRemainingSeconds: integer("time_remaining_seconds"),
    playTime: timestamp("play_time", { withTimezone: true }), // Actual timestamp from API
    down: integer("down"),
    distance: integer("distance"),
    yardLine: integer("yard_line"),
    yardLineTerritory: text("yard_line_territory"), // Team abbreviation
    yardsToEndZone: integer("yards_to_end_zone"),
    playType: text("play_type"), // "Pass", "Rush", "Kickoff", "Punt", etc.
    team: text("team").notNull(), // Team with possession
    opponent: text("opponent").notNull(), // Opposing team
    description: text("description"), // Human-readable play description
    lockTime: timestamp("lock_time", { withTimezone: true }).notNull(),
    status: playStatus("status").notNull().default("open"),
    actualOutcome: playOutcome("actual_outcome"), // Derived from playType
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.gameId],
      foreignColumns: [games.id],
      name: "game_plays_game_id_fkey",
    }).onDelete("cascade"),
    unique("game_plays_game_id_sequence_key").on(table.gameId, table.sequence),
    index("idx_game_plays_game_id").on(table.gameId),
    index("idx_game_plays_provider_play_id").on(table.providerPlayId),
    index("idx_game_plays_status_lock_time").on(table.status, table.lockTime),
    index("idx_game_plays_status").on(table.status),
    index("idx_game_plays_play_type").on(table.playType),
  ],
);

/**
 * Links competitions to NFL games
 * Allows a single competition to track multiple concurrent games
 */
export const competitionGames = pgTable(
  "competition_games",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    gameId: uuid("game_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_games_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId],
      foreignColumns: [games.id],
      name: "competition_games_game_id_fkey",
    }).onDelete("cascade"),
    unique("competition_games_competition_id_game_id_key").on(
      table.competitionId,
      table.gameId,
    ),
    index("idx_competition_games_competition_id").on(table.competitionId),
    index("idx_competition_games_game_id").on(table.gameId),
  ],
);

/**
 * Agent predictions for game plays
 * Stores run/pass predictions with confidence scores
 */
export const predictions = pgTable(
  "predictions",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    gamePlayId: uuid("game_play_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    prediction: playOutcome("prediction").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "predictions_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gamePlayId],
      foreignColumns: [gamePlays.id],
      name: "predictions_game_play_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "predictions_agent_id_fkey",
    }).onDelete("cascade"),
    unique("predictions_agent_id_competition_id_game_play_id_key").on(
      table.agentId,
      table.competitionId,
      table.gamePlayId,
    ),
    index("idx_predictions_competition_id_game_play_id").on(
      table.competitionId,
      table.gamePlayId,
    ),
    index("idx_predictions_game_play_id").on(table.gamePlayId),
    index("idx_predictions_agent_id").on(table.agentId),
  ],
);

/**
 * Aggregated competition scores for agents
 * Tracks accuracy and Brier score across all predictions
 */
export const competitionScores = pgTable(
  "competition_scores",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    totalPredictions: integer("total_predictions").notNull().default(0),
    correctPredictions: integer("correct_predictions").notNull().default(0),
    brierSum: numeric("brier_sum", { precision: 10, scale: 6 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_scores_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "competition_scores_agent_id_fkey",
    }).onDelete("cascade"),
    unique("competition_scores_competition_id_agent_id_key").on(
      table.competitionId,
      table.agentId,
    ),
    index("idx_competition_scores_competition_id").on(table.competitionId),
    index("idx_competition_scores_agent_id").on(table.agentId),
  ],
);
