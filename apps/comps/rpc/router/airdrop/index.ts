import { getClaimsData } from "./get-claims-data";
import { getNextAirdropEligibility } from "./get-next-season-eligibility";

export const router = {
  getClaimsData,
  getNextAirdropEligibility,
} as const;
