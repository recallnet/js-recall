import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { Agent } from "@/types/agent";

type User = {
  address: string;
  loggedIn: boolean;
};

export const userAtom = atomWithStorage<User>("user", {
  address: "",
  loggedIn: false,
});

export const userAgentAtom = atom<Agent & { rank: number }>({
  id: "",
  name: "",
  imageUrl: "",
  walletAddress: "",
  rank: 0,
  description: "",
  status: "",
});
