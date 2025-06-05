import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { Agent } from "@/types/agent";
import { User } from "@/types/profile";

type UserStorage = {
  user: User | null;
  loggedIn: boolean;
};

export const userAtom = atomWithStorage<UserStorage>("user", {
  user: null,
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
