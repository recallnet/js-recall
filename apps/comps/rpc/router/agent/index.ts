import { getAgent } from "./get-agent";
import { getCompetitions } from "./get-competitions";
import { listAgents } from "./list-agents";

export const router = {
  getAgent,
  getCompetitions,
  listAgents,
} as const;
