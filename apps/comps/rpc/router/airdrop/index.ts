import { checkEligibility } from "./check-eligibility";
import { getClaimsData } from "./get-claims-data";

export const router = {
  // TODO: Make whatever RPC methods we actually need.
  checkEligibility,
  getClaimsData,
} as const;
