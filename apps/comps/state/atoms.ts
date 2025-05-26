import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { zeroAddress } from "viem";

import { LeaderboardAgent } from "@/types/agent";

type User = {
  address: string;
  loggedIn: boolean;
};

export const userAtom = atomWithStorage<User>("user", {
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<LeaderboardAgent>({
  id: "",
  name: "",
  imageUrl: "",
  metadata: {
    walletAddress: zeroAddress,
  },
  rank: 0,
  skills: [],
  apiKey: "",
  registeredCompetitionIds: [],
  userId: undefined,
  stats: undefined,
  trophies: undefined,
  hasUnclaimedRewards: false,
  score: 0,
  rewards: undefined,
});
