import { createAgent } from "./create-agent";
import { getAgent } from "./get-agent";
import { getAgentApiKey } from "./get-agent-api-key";
import { getAgents } from "./get-agents";
import { updateAgentProfile } from "./update-agent-profile";

export const router = {
  createAgent,
  getAgents,
  getAgent,
  getAgentApiKey,
  updateAgentProfile,
} as const;
