import { v4 as uuidv4 } from "uuid";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Artillery function types
type ArtilleryContext = {
  vars: {
    users: { userId: string; agentId: string; apiKey: string }[];
  } & Record<string, unknown>;
};

type ArtilleryEvents = unknown;
type ArtilleryDone = () => void;

export function generateRandomUserAndAgent(
  requestParams: unknown,
  context: ArtilleryContext,
  events: ArtilleryEvents,
  done: ArtilleryDone,
) {
  // Generate user data
  context.vars.userName = `User ${uuidv4()}`;
  context.vars.userEmail = `user-${uuidv4()}@test.com`;
  context.vars.userImageUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${uuidv4()}`;

  // Generate agent data
  context.vars.agentName = `Agent ${uuidv4()}`;
  context.vars.agentHandle = `agent_${uuidv4().replace(/-/g, "")}`.slice(0, 15);
  context.vars.agentDescription = "A test trading agent for load testing";
  context.vars.agentImageUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${uuidv4()}`;

  // Generate wallet addresses using Viem
  const userPrivateKey = generatePrivateKey();
  const userAccount = privateKeyToAccount(userPrivateKey);
  context.vars.walletAddress = userAccount.address;

  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  context.vars.agentWalletAddress = agentAccount.address;

  return done();
}

export function logResponse(
  requestParams: unknown,
  response: { body: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  // console.log("Request:", requestParams);
  // console.log("Response:", response.body);
  return next();
}

export function extractUserAndAgentInfo(
  requestParams: unknown,
  response: {
    body: { user?: { id: string }; agent?: { id: string; apiKey: string } };
  },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const body = response.body
    ? JSON.parse(response.body as unknown as string)
    : {};

  if (!context.vars.users) {
    context.vars.users = [];
  }

  if (body.user && body.agent) {
    context.vars.users.push({
      userId: body.user.id,
      agentId: body.agent.id,
      apiKey: body.agent.apiKey,
    });
  }

  return next();
}

export function beforeTrade(
  context: ArtilleryContext,
  events: ArtilleryEvents,
  done: ArtilleryDone,
) {
  if (!context.vars.users || context.vars.users.length === 0) {
    console.warn("No users available, cannot set apiKey");
    return done();
  }

  const selectedUser = context.vars.users.pop();

  context.vars.apiKey = selectedUser?.apiKey ?? "";

  return done();
}
