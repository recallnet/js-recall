import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { Agent } from "@/types/agent";
import { User } from "@/types/profile";

export type AuthStatus =
  | "unauthenticated" // No active session
  | "authenticating" // Wallet signature has succeeded – waiting for profile
  | "authenticated"; // Profile successfully fetched

export type UserStorage = {
  /**
   * The authenticated user profile. It is
   * `null` while we are either unauthenticated or still fetching the full
   * profile (status === "authenticating").
   */
  user: User | null;
  /**
   * Finite-state machine that represents the current auth state.
   */
  status: AuthStatus;
};

export const userAtom = atomWithStorage<UserStorage>("user", {
  user: null,
  status: "unauthenticated",
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

export const useUser = (): UserStorage => {
  const [user] = useAtom(userAtom);
  return user;
};
