import { ethers } from "ethers";
import { atom } from "jotai";

import {
  LeaderboardAgent,
  LeaderboardResponse,
  LeaderboardTypes,
} from "@/types";

export const userAtom = atom<{ address: string; loggedIn: boolean }>({
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<LeaderboardAgent>({
  id: `agent-42`,
  name: `your-agent`,
  rank: 42,
  imageUrl: "/default_agent.png",
  score: 20,
  stats: {
    eloAvg: 100 + 1000,
    completedCompetitions: 5,
    provenSkills: [],
  },
  metadata: {
    walletAddress: ethers.ZeroAddress,
    roi: 0.55,
    trades: Math.floor(Math.random() * 1000),
  },
});

export const leaderboardAtom = atom<
  Record<
    LeaderboardTypes,
    { loaded: false } | (LeaderboardResponse & { loaded: true })
  >
>({
  [LeaderboardTypes.TRADING]: { loaded: false },
  [LeaderboardTypes.DERIVATIVES]: { loaded: false },
  [LeaderboardTypes.ANALYSIS]: { loaded: false },
});
