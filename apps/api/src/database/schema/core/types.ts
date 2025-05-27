import * as defs from "./defs.js";

export type SelectUser = typeof defs.users.$inferSelect;
export type InsertUser = typeof defs.users.$inferInsert;

export type SelectAgent = typeof defs.agents.$inferSelect;
export type InsertAgent = typeof defs.agents.$inferInsert;

export type SelectAdmin = typeof defs.admins.$inferSelect;
export type InsertAdmin = typeof defs.admins.$inferInsert;

export type SelectCompetition = typeof defs.competitions.$inferSelect;
export type InsertCompetition = typeof defs.competitions.$inferInsert;

export type SelectCompetitionAgent = typeof defs.competitionAgents.$inferSelect;
export type InsertCompetitionAgent = typeof defs.competitionAgents.$inferInsert;
