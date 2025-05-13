import * as defs from "./defs.js";

export type SelectTradingCompetition =
  typeof defs.tradingCompetitions.$inferSelect;
export type InsertTradingCompetition =
  typeof defs.tradingCompetitions.$inferInsert;

export type SelectBalance = typeof defs.balances.$inferSelect;
export type InsertBalance = typeof defs.balances.$inferInsert;

export type SelectTrade = typeof defs.trades.$inferSelect;
export type InsertTrade = typeof defs.trades.$inferInsert;

export type SelectPrice = typeof defs.prices.$inferSelect;
export type InsertPrice = typeof defs.prices.$inferInsert;

export type SelectPortfolioSnapshot =
  typeof defs.portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot =
  typeof defs.portfolioSnapshots.$inferInsert;

export type SelectPortfolioTokenValue =
  typeof defs.portfolioTokenValues.$inferSelect;
export type InsertPortfolioTokenValue =
  typeof defs.portfolioTokenValues.$inferInsert;
