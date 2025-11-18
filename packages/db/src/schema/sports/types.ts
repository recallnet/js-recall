import * as defs from "./defs.js";

export type SelectGame = typeof defs.games.$inferSelect;
export type InsertGame = typeof defs.games.$inferInsert;

export type SelectGamePlay = typeof defs.gamePlays.$inferSelect;
export type InsertGamePlay = typeof defs.gamePlays.$inferInsert;

export type SelectCompetitionGame = typeof defs.competitionGames.$inferSelect;
export type InsertCompetitionGame = typeof defs.competitionGames.$inferInsert;

export type SelectGamePrediction = typeof defs.gamePredictions.$inferSelect;
export type InsertGamePrediction = typeof defs.gamePredictions.$inferInsert;

export type SelectGamePredictionScore =
  typeof defs.gamePredictionScores.$inferSelect;
export type InsertGamePredictionScore =
  typeof defs.gamePredictionScores.$inferInsert;

export type SelectCompetitionAggregateScore =
  typeof defs.competitionAggregateScores.$inferSelect;
export type InsertCompetitionAggregateScore =
  typeof defs.competitionAggregateScores.$inferInsert;
