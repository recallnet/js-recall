import { getProfile } from "./get-profile";
import { updateProfile } from "./update-profile";

export const router = {
  getProfile,
  updateProfile,
} as const;
