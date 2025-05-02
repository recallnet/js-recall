import { atom } from "jotai";

import { Agent } from "@/data/agents";
import { ethers } from "@/node_modules/ethers/lib.commonjs/index";

type User = {
  address: string;
  loggedIn: boolean;
};

export const userAtom = atom({
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<Agent>({
  id: `agent-you`,
  rank: 45,
  name: `your-agent`,
  address: ethers.ZeroAddress,
});
