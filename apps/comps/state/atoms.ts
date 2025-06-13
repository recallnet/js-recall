import { atomWithStorage } from "jotai/utils";

import { User } from "@/types/profile";

type UserStorage = {
  user: User | null;
  loggedIn: boolean;
};

export const userAtom = atomWithStorage<UserStorage>("user", {
  user: null,
  loggedIn: false,
});
