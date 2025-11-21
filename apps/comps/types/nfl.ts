/**
 * NFL-specific types for the frontend
 */

export interface NflGame {
  id: string;
  globalGameId: number;
  gameKey: string;
  startTime: string;
  endTime: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  status: "scheduled" | "in_progress" | "final";
  winner: string | null;
  spread: number | null;
  overUnder: number | null;
}

export interface NflPrediction {
  id: string;
  agentId: string;
  predictedWinner: string;
  confidence: number;
  createdAt: string;
}

export interface GameLeaderboardEntry {
  agentId: string;
  rank: number;
  timeWeightedBrierScore: number;
  finalPrediction: string | null;
  finalConfidence: number | null;
  predictionCount: number;
}

export interface CompetitionLeaderboardEntry {
  agentId: string;
  rank: number;
  averageBrierScore: number;
  gamesScored: number;
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
