import * as defs from "./defs.js";

export type SelectTradingCompetition =
  typeof defs.tradingCompetitions.$inferSelect;
export type InsertTradingCompetition =
  typeof defs.tradingCompetitions.$inferInsert;

export type SelectBalance = typeof defs.balances.$inferSelect;
export type InsertBalance = typeof defs.balances.$inferInsert;

export type SelectTrade = typeof defs.trades.$inferSelect;
export type InsertTrade = typeof defs.trades.$inferInsert;

export type SelectPortfolioSnapshot =
  typeof defs.portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot =
  typeof defs.portfolioSnapshots.$inferInsert;

export type SelectTradingConstraints =
  typeof defs.tradingConstraints.$inferSelect;
export type InsertTradingConstraints =
  typeof defs.tradingConstraints.$inferInsert;

export type SelectPerpsCompetitionConfig =
  typeof defs.perpsCompetitionConfig.$inferSelect;
export type InsertPerpsCompetitionConfig =
  typeof defs.perpsCompetitionConfig.$inferInsert;

export type SelectPerpetualPosition =
  typeof defs.perpetualPositions.$inferSelect;
export type InsertPerpetualPosition =
  typeof defs.perpetualPositions.$inferInsert;

export type SelectPerpsAccountSummary =
  typeof defs.perpsAccountSummaries.$inferSelect;
export type InsertPerpsAccountSummary =
  typeof defs.perpsAccountSummaries.$inferInsert;

export type SelectPerpsSelfFundingAlert =
  typeof defs.perpsSelfFundingAlerts.$inferSelect;
export type InsertPerpsSelfFundingAlert =
  typeof defs.perpsSelfFundingAlerts.$inferInsert;

export type SelectPerpsTransferHistory =
  typeof defs.perpsTransferHistory.$inferSelect;
export type InsertPerpsTransferHistory =
  typeof defs.perpsTransferHistory.$inferInsert;

export type SelectPerpsRiskMetrics = typeof defs.perpsRiskMetrics.$inferSelect;
export type InsertPerpsRiskMetrics = typeof defs.perpsRiskMetrics.$inferInsert;

export type SelectPerpsTwrPeriod = typeof defs.perpsTwrPeriods.$inferSelect;
export type InsertPerpsTwrPeriod = typeof defs.perpsTwrPeriods.$inferInsert;

/**
 * Risk-adjusted leaderboard entry combining account summary and risk metrics
 */
export interface RiskAdjustedLeaderboardEntry {
  agentId: string;
  totalEquity: string;
  totalPnl: string | null;
  calmarRatio: string | null;
  timeWeightedReturn: string | null;
  maxDrawdown: string | null;
  hasRiskMetrics: boolean;
}
