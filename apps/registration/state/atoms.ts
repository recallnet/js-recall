import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { User } from "@/types/auth";

export type AuthStatus = "unauthenticated" | "authenticated";

export type UserStorage = {
  user: User | null;
  status: AuthStatus;
};

/**
 * User atom with persistent storage for authentication state
 */
export const userAtom = atomWithStorage<UserStorage>(
  "user",
  {
    user: null,
    status: "unauthenticated",
  },
  undefined,
  {
    getOnInit: true,
  },
);

/**
 * Hook to get current user state
 * @returns Current user storage state
 */
export const useUser = (): UserStorage => {
  const [user] = useAtom(userAtom);
  return user;
};
