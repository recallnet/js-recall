import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { User } from "@/types/profile";

export type AuthStatus = "unauthenticated" | "authenticated";

export type UserStorage = {
  user: User | null;
  status: AuthStatus;
};

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

export const useUser = (): UserStorage => {
  const [user] = useAtom(userAtom);
  return user;
};
