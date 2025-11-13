import * as defs from "./defs.js";

export type SelectGame = typeof defs.games.$inferSelect;
export type InsertGame = typeof defs.games.$inferInsert;

export type SelectGamePlay = typeof defs.gamePlays.$inferSelect;
export type InsertGamePlay = typeof defs.gamePlays.$inferInsert;

export type SelectCompetitionGame = typeof defs.competitionGames.$inferSelect;
export type InsertCompetitionGame = typeof defs.competitionGames.$inferInsert;

export type SelectPrediction = typeof defs.predictions.$inferSelect;
export type InsertPrediction = typeof defs.predictions.$inferInsert;

export type SelectCompetitionScore = typeof defs.competitionScores.$inferSelect;
export type InsertCompetitionScore = typeof defs.competitionScores.$inferInsert;
