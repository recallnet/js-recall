import type { CompetitionStatus } from "@recallnet/db/repositories/types";

import type { RouterOutputs } from "@/rpc/router";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { Agent } from "./agent";
import { PaginationResponse } from "./api";
import { CrossChainTradingType } from "./enums";

export interface Reward {
  name: string;
  amount: string;
  claimed?: string | null;
}

export interface CompetitionMetadata {
  discordUrl?: string;
  [k: string]: unknown;
}

export interface TradingCompetitionSummary {
  totalTrades?: number;
  volume?: string;
}

export interface AgentCompetitionMetadata {
  [k: string]: unknown;
}

export interface AgentStatus {
  agentId: string;
  name: string;
  score: number;
  rank: number;
  joinedDate: string;
  rewards: Reward[];
  metadata: {
    trades?: number;
    roi?: number;
    [k: string]: unknown;
  };
}

export type CompetitionType =
  | "trading"
  | "perpetual_futures"
  | "spot_live_trading";

export type EvaluationMetric =
  | "calmar_ratio"
  | "sortino_ratio"
  | "simple_return"
  | "max_drawdown"
  | "total_pnl";

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
  type: CompetitionType;
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType;
  startDate: string | null;
  endDate: string | null;
  joinStartDate: string | null;
  joinEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalTrades?: number; // Only for paper trading competitions
    totalAgents: number;
    totalVolume?: number; // May not be present for all competition types
    uniqueTokens?: number; // Only for paper trading competitions
    totalPositions?: number; // Only for perpetual futures competitions
    averageEquity?: number; // Only for perpetual futures competitions
  };
  boostStartDate: string | null;
  boostEndDate: string | null;
  portfolioValue?: number;
  pnl?: number;
  pnlPercent?: number;
  totalTrades?: number; // Agent's total trades (paper trading competitions)
  totalPositions?: number; // Agent's total positions (perpetual futures competitions)
  bestPlacement?: {
    rank?: number;
    totalAgents?: number;
  };
  // Risk metrics for perpetual futures competitions
  calmarRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  hasRiskMetrics?: boolean;
  rewards?: {
    rank: number;
    reward: number;
    agentId?: string;
  }[];
  rewardsTge?: {
    agentPool: string;
    userPool: string;
  };
  // Registration limit fields
  maxParticipants: number | null;
  registeredParticipants: number;
  // Evaluation metric for perps competitions (determines ranking)
  evaluationMetric?: EvaluationMetric;
}

export interface CompetitionResponse {
  success: boolean;
  competition: Competition;
}

export interface CompetitionTimelineResponse {
  success: boolean;
  competitionId: string;
  timeline: {
    agentId: string;
    agentName: string;
    timeline: {
      timestamp: string;
      totalValue: number;
    }[];
  }[];
}

export interface CompetitionsMetadata {
  total: number;
  limit: number;
  offset: number;
}

export interface CompetitionsResponse {
  pagination: PaginationResponse;
  competitions: Competition[];
}

export interface UserCompetitionsResponse {
  success: boolean;
  total: number;
  pagination: PaginationResponse;
  competitions: UserCompetition[];
}

export type CompetitionWithUserAgents = ReturnType<
  typeof mergeCompetitionsWithUserData
>[0];

export interface UserAgentCompetition extends Agent {
  rank: number;
}

export interface UserCompetition extends Competition {
  agents: UserAgentCompetition[];
}

export interface JoinCompetitionResponse {
  success: boolean;
  message: string;
}

export interface CompetitionRulesResponse {
  success: boolean;
  competition?: Competition; // Optional, included in response
  rules: CompetitionRules;
}

export interface CompetitionRules {
  tradingRules: string[];
  rateLimits: string[];
  availableChains: {
    svm: boolean;
    evm: string[];
  };
  slippageFormula: string;
  portfolioSnapshots: {
    interval: string;
  };
  tradingConstraints?: {
    minimumPairAgeHours: number;
    minimum24hVolumeUsd: number;
    minimumLiquidityUsd: number;
    minimumFdvUsd: number;
    minTradesPerDay?: number | null;
  };
}

export type Trade =
  RouterOutputs["competitions"]["getTrades"]["trades"][number];

export interface GetCompetitionTradesParams {
  limit?: number;
  offset?: number;
}

export interface GetCompetitionPerpsPositionsParams {
  limit?: number;
  offset?: number;
  status?: string; // Optional filter: "Open", "Closed", "Liquidated"
}

export type CompetitionTradesResponse =
  RouterOutputs["competitions"]["getTrades"];

export type PerpsPosition =
  RouterOutputs["competitions"]["getPerpsPositions"]["positions"][number];

export type CompetitionPerpsPositionsResponse =
  RouterOutputs["competitions"]["getPerpsPositions"];
