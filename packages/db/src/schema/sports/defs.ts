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
 * NFL team abbreviations
 */
export const nflTeam = pgEnum("nfl_team", [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
]);

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
    endTime: timestamp("end_time", { withTimezone: true }), // Set when game status becomes "final"
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    venue: text("venue"),
    status: gameStatus("status").notNull().default("scheduled"),
    winner: text("winner"), // Team ticker of winner, set when game is final
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
 * Agent predictions for game winners
 * Stores game winner predictions with confidence scores
 * Agents can update predictions multiple times (history is preserved)
 */
export const gamePredictions = pgTable(
  "game_predictions",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    gameId: uuid("game_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    predictedWinner: text("predicted_winner").notNull(), // Team ticker: "MIN", "CHI", etc.
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(), // 0.0 - 1.0
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "game_predictions_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId],
      foreignColumns: [games.id],
      name: "game_predictions_game_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "game_predictions_agent_id_fkey",
    }).onDelete("cascade"),
    index("idx_game_predictions_competition_id_game_id_agent_id_created_at").on(
      table.competitionId,
      table.gameId,
      table.agentId,
      table.createdAt,
    ),
    index("idx_game_predictions_game_id_agent_id").on(
      table.gameId,
      table.agentId,
    ),
    index("idx_game_predictions_competition_id").on(table.competitionId),
    index("idx_game_predictions_game_id").on(table.gameId),
    index("idx_game_predictions_agent_id").on(table.agentId),
  ],
);

/**
 * Per-game prediction scores with time-weighted Brier scoring
 * Tracks agent performance for individual games
 */
export const gamePredictionScores = pgTable(
  "game_prediction_scores",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    gameId: uuid("game_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    timeWeightedBrierScore: numeric("time_weighted_brier_score", {
      precision: 10,
      scale: 6,
    }).notNull(),
    finalPrediction: text("final_prediction"), // Last prediction before game ended
    finalConfidence: numeric("final_confidence", { precision: 4, scale: 3 }),
    predictionCount: integer("prediction_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "game_prediction_scores_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId],
      foreignColumns: [games.id],
      name: "game_prediction_scores_game_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "game_prediction_scores_agent_id_fkey",
    }).onDelete("cascade"),
    unique("game_prediction_scores_competition_id_game_id_agent_id_key").on(
      table.competitionId,
      table.gameId,
      table.agentId,
    ),
    index("idx_game_prediction_scores_competition_id").on(table.competitionId),
    index("idx_game_prediction_scores_game_id").on(table.gameId),
    index("idx_game_prediction_scores_agent_id").on(table.agentId),
  ],
);

/**
 * Aggregate scores across all games in a competition
 * Used for overall competition leaderboard
 */
export const competitionAggregateScores = pgTable(
  "competition_aggregate_scores",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    averageBrierScore: numeric("average_brier_score", {
      precision: 10,
      scale: 6,
    }).notNull(),
    gamesScored: integer("games_scored").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_aggregate_scores_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "competition_aggregate_scores_agent_id_fkey",
    }).onDelete("cascade"),
    unique("competition_aggregate_scores_competition_id_agent_id_key").on(
      table.competitionId,
      table.agentId,
    ),
    index("idx_competition_aggregate_scores_competition_id").on(
      table.competitionId,
    ),
    index("idx_competition_aggregate_scores_agent_id").on(table.agentId),
  ],
);
