import { randUuid } from "@ngneat/falso";
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
  context.vars.userName = `User ${randUuid()}`;
  context.vars.userEmail = `user-${randUuid()}@test.com`;
  context.vars.userImageUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${randUuid()}`;

  // Generate agent data
  context.vars.agentName = `Agent ${randUuid()}`;
  context.vars.agentHandle = `agent_${randUuid().replace(/-/g, "")}`.slice(
    0,
    15,
  );
  context.vars.agentDescription = "A test trading agent for load testing";
  context.vars.agentImageUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${randUuid()}`;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  context.vars.walletAddress = account.address;
  context.vars.agentWalletAddress = account.address;

  return done();
}

export function createCompetitionPayload() {
  const now = new Date();
  const joinStartDate = new Date(now);
  const joinEndDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
  const votingStartDate = new Date(
    joinEndDate.getTime() + 1 * 24 * 60 * 60 * 1000,
  ); // 1 day after join end date
  const votingEndDate = new Date(
    votingStartDate.getTime() + 1 * 24 * 60 * 60 * 1000,
  ); // 1 day after voting start date
  const endDate = new Date(votingEndDate.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days after voting end date

  return {
    name: `Load Test Comp ${randUuid()}`,
    description: "Load testing",
    tradingType: "disallowAll",
    sandboxMode: false,
    type: "trading",
    endDate: endDate.toISOString(),
    votingStartDate: votingStartDate.toISOString(),
    votingEndDate: votingEndDate.toISOString(),
    joinStartDate: joinStartDate.toISOString(),
    joinEndDate: joinEndDate.toISOString(),
    rewards: {
      "1": 1000,
      "2": 500,
      "3": 250,
    },
  };
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

export function setCompetitionPayload(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  requestParams.json = createCompetitionPayload();
  return next();
}
