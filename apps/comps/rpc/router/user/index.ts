import { createAgent } from "./create-agent";
import { getAgentApiKey } from "./get-agent-api-key";
import { getCompetitions } from "./get-competitions";
import { getProfile } from "./get-profile";
import { getUserAgent } from "./get-user-agent";
import { getUserAgents } from "./get-user-agents";
import { linkWallet } from "./link-wallet";
import { login } from "./login";
import { subscribe } from "./subscribe";
import { unsubscribe } from "./unsubscribe";
import { updateAgentProfile } from "./update-agent-profile";
import { updateProfile } from "./update-profile";

export const router = {
  getProfile,
  updateProfile,
  linkWallet,
  login,
  subscribe,
  unsubscribe,
  getCompetitions,
  getUserAgent,
  getUserAgents,
  createAgent,
  getAgentApiKey,
  updateAgentProfile,
} as const;
