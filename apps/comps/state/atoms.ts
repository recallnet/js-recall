import { atom } from "jotai";

type User = {
  address: string;
  loggedIn: boolean;
};

export const userAtom = atom({
  address: "",
  loggedIn: false,
});
