import { getClaimsData } from "./get-claims-data";
import { getNextSeasonEligibility } from "./get-next-season-eligibility";

export const router = {
  getClaimsData,
  getNextSeasonEligibility,
} as const;
