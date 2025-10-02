import { getCompetitions } from "./get-competitions";
import { getProfile } from "./get-profile";
import { linkWallet } from "./link-wallet";
import { subscribe } from "./subscribe";
import { unsubscribe } from "./unsubscribe";
import { updateProfile } from "./update-profile";

export const router = {
  getProfile,
  updateProfile,
  linkWallet,
  subscribe,
  unsubscribe,
  getCompetitions,
} as const;
