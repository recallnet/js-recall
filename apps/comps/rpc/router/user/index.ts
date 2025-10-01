import { getProfile } from "./get-profile";
import { linkWallet } from "./link-wallet";
import { updateProfile } from "./update-profile";

export const router = {
  getProfile,
  updateProfile,
  linkWallet,
} as const;
