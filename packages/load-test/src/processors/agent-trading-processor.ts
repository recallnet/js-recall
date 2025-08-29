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

/**
 * Decide a realistic trade (buy or sell) between USDC and WETH based on current balances
 * and set the trade payload on the outgoing request. The approach is a light-weight
 * rebalance strategy:
 *
 * - Compute current portfolio weights for WETH vs USDC on EVM/ETH
 * - If WETH < 45%: buy WETH with a small USDC tranche (≈2% of USDC, min 50, max 200)
 * - If WETH > 55%: sell a small WETH tranche (≈2% of WETH amount, min 0.00005, max 0.002)
 * - Otherwise: make a small nudge (buy $25 if USDC available, otherwise sell 0.00005 WETH)
 *
 * The function expects environment-provided tokens in context (usdcToken, wethToken)
 * and previously stored balances in `context.vars.balances` (set via Artillery capture).
 *
 * @param requestParams - The mutable request configuration; `json` will be set here
 * @param context - Artillery virtual user context; expects `balances`, `usdcToken`, `wethToken`
 * @param ee - Artillery event emitter (unused)
 * @param next - Continuation callback
 */
export function decideTradeFromBalances(
  requestParams: { json?: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars as Record<string, unknown>).balances as Array<{
    symbol?: string;
    chain?: string;
    specificChain?: string;
    amount?: number;
    value?: number;
    price?: number;
    tokenAddress?: string;
  }>; // may be undefined

  const usdcToken = (context.vars as Record<string, unknown>).usdcToken as
    | string
    | undefined;
  const wethToken = (context.vars as Record<string, unknown>).wethToken as
    | string
    | undefined;

  // Guard for missing inputs; default to a tiny buy to keep the scenario moving
  if (!Array.isArray(balances) || !usdcToken || !wethToken) {
    requestParams.json = {
      fromToken: usdcToken ?? "",
      toToken: wethToken ?? "",
      amount: "25",
      reason: "Default buy due to missing balances/tokens",
      fromChain: "EVM",
      toChain: "EVM",
    };
    return next();
  }

  const normalize = (s: string | undefined) => (s ?? "").toLowerCase();
  const usdc = balances.find(
    (b) => normalize(b.tokenAddress) === normalize(usdcToken),
  );
  const weth = balances.find(
    (b) => normalize(b.tokenAddress) === normalize(wethToken),
  );

  const usdcValue = (usdc?.value ?? 0) as number;
  const wethValue = (weth?.value ?? 0) as number;
  const usdcAmount = (usdc?.amount ?? 0) as number;
  const wethAmount = (weth?.amount ?? 0) as number;

  const totalValue = usdcValue + wethValue;
  const wethWeight = totalValue > 0 ? wethValue / totalValue : 0;

  // Helper clamps
  const clampNumber = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  // Decide direction
  let fromToken: string;
  let toToken: string;
  let amountStr: string;
  let reason: string;

  if (totalValue > 0 && wethWeight < 0.45 && usdcAmount > 10) {
    // Buy WETH using ≈2% of USDC value, bounded [50, 200]
    const trancheUsd = clampNumber(Math.round(usdcValue * 0.02), 50, 200);
    const spendUsd = Math.min(trancheUsd, Math.max(0, usdcAmount - 1)); // keep a small buffer
    fromToken = usdcToken;
    toToken = wethToken;
    amountStr = String(
      spendUsd > 0 ? spendUsd : Math.min(25, Math.max(1, usdcAmount)),
    );
    reason = `Rebalance: Buy WETH (w=${(wethWeight * 100).toFixed(1)}%)`;
  } else if (totalValue > 0 && wethWeight > 0.55 && wethAmount > 0.00001) {
    // Sell WETH: ≈2% of WETH amount, bounded [0.00005, 0.002]
    const trancheWeth = clampNumber(wethAmount * 0.02, 0.00005, 0.002);
    const sellWeth = Math.min(trancheWeth, Math.max(0, wethAmount - 0.00001)); // keep a dust buffer
    fromToken = wethToken;
    toToken = usdcToken;
    amountStr = String(sellWeth > 0 ? sellWeth : 0.00005);
    reason = `Rebalance: Sell WETH (w=${(wethWeight * 100).toFixed(1)}%)`;
  } else {
    // Nudge: prefer a small buy if USDC exists; otherwise a tiny sell if WETH exists
    if (usdcAmount > 25) {
      fromToken = usdcToken;
      toToken = wethToken;
      amountStr = "25";
      reason = "Nudge: Buy small WETH tranche";
    } else if (wethAmount > 0.00005) {
      fromToken = wethToken;
      toToken = usdcToken;
      amountStr = "0.00005";
      reason = "Nudge: Sell tiny WETH tranche";
    } else {
      fromToken = usdcToken;
      toToken = wethToken;
      amountStr = String(Math.max(1, Math.min(10, usdcAmount)));
      reason = "Fallback: Minimal buy due to low balances";
    }
  }

  requestParams.json = {
    fromToken,
    toToken,
    amount: amountStr,
    reason,
    fromChain: "EVM",
    toChain: "EVM",
  };

  return next();
}
