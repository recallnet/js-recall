import { getAgent } from "./get-agent";
import { listAgents } from "./list-agents";

export const router = {
  getAgent,
  listAgents,
} as const;
