import { randUuid } from "@ngneat/falso";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates random user data for load testing
 */
export function generateUserData() {
  return {
    userName: `User ${randUuid()}`,
    userEmail: `user-${randUuid()}@test.com`,
    userImageUrl: `https://api.dicebear.com/9.x/pixel-art/png?seed=${randUuid()}`,
    userHandle: `user_${randUuid().replace(/-/g, "")}`.slice(0, 15),
  };
}

/**
 * Generates random agent data for load testing
 */
export function generateAgentData() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    agentName: `Agent ${randUuid()}`,
    agentHandle: `agent_${randUuid().replace(/-/g, "")}`.slice(0, 15),
    agentDescription: "Load test agent",
    agentImageUrl: `https://api.dicebear.com/9.x/pixel-art/png?seed=${randUuid()}`,
    walletAddress: account.address,
    agentWalletAddress: account.address,
  };
}

/**
 * Generates complete user and agent data
 */
export function generateUserAndAgent() {
  return {
    ...generateUserData(),
    ...generateAgentData(),
  };
}
