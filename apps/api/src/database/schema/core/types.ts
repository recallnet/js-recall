import * as defs from "./defs.js";

export type SelectTeam = typeof defs.teams.$inferSelect;
export type InsertTeam = typeof defs.teams.$inferInsert;

export type SelectCompetition = typeof defs.competitions.$inferSelect;
export type InsertCompetition = typeof defs.competitions.$inferInsert;

export type SelectCompetitionTeam = typeof defs.competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof defs.competitionTeams.$inferInsert;
