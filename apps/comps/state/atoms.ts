import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { User } from "@/types/profile";

export type AuthStatus = "unauthenticated" | "pending" | "authenticated";

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
  {
    getItem: (key: string) => {
      if (typeof window === "undefined") {
        // Return default value for SSR
        return { user: null, status: "unauthenticated" };
      }
      const item = localStorage.getItem(key);
      if (!item) {
        // Return default value if no item exists
        return { user: null, status: "unauthenticated" };
      }
      try {
        return JSON.parse(item);
      } catch {
        // Return default value if parsing fails
        return { user: null, status: "unauthenticated" };
      }
    },
    setItem: (key: string, value: UserStorage) => {
      if (typeof window === "undefined") return;

      // If logging out (user is null and status is unauthenticated), remove the item entirely
      if (!value.user && value.status === "unauthenticated") {
        localStorage.removeItem(key);
        return;
      }

      // Otherwise, store normally
      localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem: (key: string) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  },
  {
    getOnInit: true,
  },
);

export const useUser = (): UserStorage => {
  const [user] = useAtom(userAtom);
  return user;
};
