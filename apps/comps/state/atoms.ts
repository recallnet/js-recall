import {atom} from "jotai";

import {
  LeaderboardAgent,
  LeaderboardResponse,
  LeaderboardTypes,
  User,
} from "@/types";
import {zeroAddress} from "viem";

export const userAtom = atom<User>({
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
    walletAddress: zeroAddress,
    roi: 0.55,
    trades: Math.floor(Math.random() * 1000),
  },
});

export const leaderboardAtom = atom<
  Record<
    LeaderboardTypes,
    {loaded: false} | (LeaderboardResponse & {loaded: true})
  >
>({
  [LeaderboardTypes.TRADING]: {loaded: false},
  [LeaderboardTypes.DERIVATIVES]: {loaded: false},
  [LeaderboardTypes.ANALYSIS]: {loaded: false},
});
