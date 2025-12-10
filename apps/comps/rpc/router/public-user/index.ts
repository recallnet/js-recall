import { getPublicAgents } from "./get-public-agents";
import { getPublicCompetitions } from "./get-public-competitions";
import { getPublicProfile } from "./get-public-profile";

export const router = {
  getPublicProfile,
  getPublicAgents,
  getPublicCompetitions,
} as const;
