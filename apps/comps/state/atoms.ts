import {atom} from "jotai";

import {ethers} from "ethers";
import {LeaderboardState, User, Agent, LeaderboardTypes} from "./types";

export const userAtom = atom<User>({
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<Agent & {rank: number}>({
  id: `agent-42`,
  name: `your-agent`,
  rank: 42,
  imageUrl: '/default_agent.png',
  score: 20,
  stats: {
    eloAvg: 100 + 1000,
    bestPlacement: {
      competitionId: '1',
      position: 1,
      participants: 100
    }
  },
  metadata: {
    walletAddress: ethers.ZeroAddress,
    roi: 0.55,
    trades: Math.floor(Math.random() * 1000)
  }
});

export const leaderboardAtom = atom<LeaderboardState>({
  [LeaderboardTypes.TRADING]: {loaded: false},
  [LeaderboardTypes.DERIVATIVES]: {loaded: false},
  [LeaderboardTypes.ANALYSIS]: {loaded: false},
});

