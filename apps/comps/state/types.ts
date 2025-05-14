

export enum LeaderboardTypes {
  TRADING = "TRADING",
  DERIVATIVES = "DERIVATIVES",
  ANALYSIS = "SENTIMENT-ANALYSIS"
}

export type User = {
  address: string;
  loggedIn: boolean;
};

export interface Agent {
  id: string;
  name: string;
  imageUrl?: string;
  score: number;
  stats: {
    eloAvg: number;
    bestPlacement: {
      competitionId: string;
      position: number;
      participants: number
    }
  };
  metadata: {
    walletAddress: string;
    roi: number;
    trades: number;
  };
}

export type Leaderboard = {
  loaded: true,
  metadata: {
    total: number;
    limit: number;
    offset: number;
  },
  stats: {
    activeAgents: number;
    totalTrades: string;
    totalVolume: string;
  },
  agents: (Agent & {rank: number})[]
}

export type LeaderboardState = Record<LeaderboardTypes, {loaded: false} | Leaderboard>

