import { atom } from "jotai";

import { ethers } from "@/node_modules/ethers/lib.commonjs/index";
import { LeaderboardAgent } from "@/types/agent";

type User = {
  address: string;
  loggedIn: boolean;
};

export const userAtom = atom({
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<LeaderboardAgent>({
  id: "",
  name: "",
  imageUrl: "",
  metadata: {
    walletAddress: ethers.ZeroAddress,
  },
  rank: 0,
});
