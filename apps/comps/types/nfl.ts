/**
 * NFL-specific types for the frontend
 */
import type {
  SelectCompetitionAggregateScore,
  SelectGame,
  SelectGamePrediction,
  SelectGamePredictionScore,
} from "@recallnet/db/schema/sports/types";

export type NflGame = Pick<
  SelectGame,
  | "id"
  | "providerGameId"
  | "season"
  | "week"
  | "startTime"
  | "endTime"
  | "homeTeam"
  | "awayTeam"
  | "venue"
  | "status"
  | "winner"
  | "spread"
  | "overUnder"
>;

export interface NflPrediction
  extends Pick<
    SelectGamePrediction,
    "id" | "agentId" | "predictedWinner" | "confidence"
  > {
  createdAt: string;
  reason?: string | null;
  agentName?: string | null;
}

export interface GameLeaderboardEntry
  extends Pick<
    SelectGamePredictionScore,
    | "agentId"
    | "timeWeightedBrierScore"
    | "finalPrediction"
    | "finalConfidence"
    | "predictionCount"
  > {
  rank: number;
  agentName?: string | null;
}

export interface CompetitionLeaderboardEntry
  extends Pick<
    SelectCompetitionAggregateScore,
    "agentId" | "averageBrierScore" | "gamesScored"
  > {
  rank: number;
  agentName?: string | null;
}

export type LeaderboardEntry =
  | GameLeaderboardEntry
  | CompetitionLeaderboardEntry;

export interface AgentScoreData {
  agentId: string;
  agentName?: string;
  gameScores: Array<{
    gameId: string;
    timeWeightedBrierScore: number;
    gameStartTime: string;
  }>;
}
