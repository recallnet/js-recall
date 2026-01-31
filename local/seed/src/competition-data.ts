/**
 * Unified competition data seeding for local development.
 *
 * This module generates coherent data for all competition types:
 * - Portfolio snapshots (for timeline charts)
 * - Trades (for paper trading and spot_live competitions)
 * - Positions (for perpetual_futures competitions)
 * - Risk metrics snapshots (for perps chart metrics)
 * - Leaderboards (for ended competitions)
 *
 * All data is generated with consistent agent ordering and proper
 * date alignment with competition start/end dates.
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

import { log } from "./utils.js";

// ============================================================================
// Types
// ============================================================================

interface AgentPerformanceProfile {
  /** Final rank (1 = best) */
  rank: number;
  /** Starting portfolio value in USD */
  startingValue: number;
  /** Ending portfolio value in USD */
  endingValue: number;
  /** Volatility factor (0-1) */
  volatility: number;
  /** Simple return percentage */
  simpleReturn: number;
  /** Calmar ratio (for perps) */
  calmarRatio: number;
  /** Sortino ratio (for perps) */
  sortinoRatio: number;
  /** Max drawdown (for perps) */
  maxDrawdown: number;
}

interface CompetitionContext {
  competitionId: string;
  competitionName: string;
  competitionType: string;
  competitionStatus: string;
  startDate: Date;
  endDate: Date;
  agents: Array<{
    agentId: string;
    profile: AgentPerformanceProfile;
  }>;
}

// ============================================================================
// Performance Profiles (ordered by rank - best first)
// ============================================================================

const PERFORMANCE_PROFILES: Omit<AgentPerformanceProfile, "rank">[] = [
  // Rank 1: Top performer
  {
    startingValue: 10000,
    endingValue: 18000,
    volatility: 0.06,
    simpleReturn: 80,
    calmarRatio: 3.5,
    sortinoRatio: 2.8,
    maxDrawdown: 0.08,
  },
  // Rank 2: Strong performer
  {
    startingValue: 10000,
    endingValue: 14500,
    volatility: 0.04,
    simpleReturn: 45,
    calmarRatio: 2.8,
    sortinoRatio: 2.2,
    maxDrawdown: 0.12,
  },
  // Rank 3: Good performer
  {
    startingValue: 10000,
    endingValue: 13000,
    volatility: 0.08,
    simpleReturn: 30,
    calmarRatio: 1.5,
    sortinoRatio: 1.4,
    maxDrawdown: 0.18,
  },
  // Rank 4: Above average
  {
    startingValue: 10000,
    endingValue: 12500,
    volatility: 0.05,
    simpleReturn: 25,
    calmarRatio: 1.8,
    sortinoRatio: 1.6,
    maxDrawdown: 0.14,
  },
  // Rank 5: Moderate performer
  {
    startingValue: 10000,
    endingValue: 11500,
    volatility: 0.07,
    simpleReturn: 15,
    calmarRatio: 0.9,
    sortinoRatio: 0.8,
    maxDrawdown: 0.22,
  },
  // Rank 6: Slight winner
  {
    startingValue: 10000,
    endingValue: 11200,
    volatility: 0.04,
    simpleReturn: 12,
    calmarRatio: 1.2,
    sortinoRatio: 1.0,
    maxDrawdown: 0.1,
  },
  // Rank 7: Conservative winner
  {
    startingValue: 10000,
    endingValue: 10800,
    volatility: 0.02,
    simpleReturn: 8,
    calmarRatio: 1.6,
    sortinoRatio: 1.3,
    maxDrawdown: 0.05,
  },
  // Rank 8: Breakeven
  {
    startingValue: 10000,
    endingValue: 10100,
    volatility: 0.03,
    simpleReturn: 1,
    calmarRatio: 0.2,
    sortinoRatio: 0.15,
    maxDrawdown: 0.06,
  },
  // Rank 9: Slight loser
  {
    startingValue: 10000,
    endingValue: 9200,
    volatility: 0.04,
    simpleReturn: -8,
    calmarRatio: -0.5,
    sortinoRatio: -0.4,
    maxDrawdown: 0.15,
  },
  // Rank 10: Moderate loser
  {
    startingValue: 10000,
    endingValue: 7500,
    volatility: 0.08,
    simpleReturn: -25,
    calmarRatio: -0.8,
    sortinoRatio: -0.7,
    maxDrawdown: 0.35,
  },
  // Rank 11: Big loser
  {
    startingValue: 10000,
    endingValue: 6500,
    volatility: 0.1,
    simpleReturn: -35,
    calmarRatio: -1.2,
    sortinoRatio: -1.0,
    maxDrawdown: 0.45,
  },
];

// ============================================================================
// Token Constants
// ============================================================================

const BASE_TOKENS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
};

const ASSET_PRICES: Record<string, number> = {
  BTC: 95000,
  ETH: 3500,
  SOL: 180,
  ARB: 1.2,
  AVAX: 35,
  LINK: 22,
  OP: 2.5,
};

const SAMPLE_TX_HASHES = [
  "0x0f8345ce2a18b4c017923d6800c18e665949444ce86491229f42f0b3f9758e04",
  "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "0x2b3c4d5e6f7890ab1234567890abcdef1234567890abcdef1234567890abcdef",
  "0x3c4d5e6f7890abcd567890abcdef1234567890abcdef1234567890abcdef1234",
];

const PROTOCOLS = ["Uniswap V3", "Aerodrome", "BaseSwap", "SushiSwap"];

// ============================================================================
// Utility Functions
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getProfile(index: number): AgentPerformanceProfile {
  const baseProfile =
    PERFORMANCE_PROFILES[index % PERFORMANCE_PROFILES.length]!;
  return {
    ...baseProfile,
    rank: index + 1,
  };
}

// ============================================================================
// Data Generation Functions
// ============================================================================

function generatePortfolioSnapshots(ctx: CompetitionContext): Array<{
  agentId: string;
  competitionId: string;
  timestamp: Date;
  totalValue: number;
}> {
  const snapshots: Array<{
    agentId: string;
    competitionId: string;
    timestamp: Date;
    totalValue: number;
  }> = [];

  const durationMs = ctx.endDate.getTime() - ctx.startDate.getTime();
  const intervalMs = 30 * 60 * 1000; // 30 minutes
  const numSnapshots = Math.max(Math.floor(durationMs / intervalMs), 10);

  for (const agent of ctx.agents) {
    const { agentId, profile } = agent;

    for (let i = 0; i <= numSnapshots; i++) {
      const progress = i / numSnapshots;
      const timestamp = new Date(
        ctx.startDate.getTime() + progress * durationMs,
      );

      // Calculate value with trend curve
      let baseValue: number;
      if (profile.simpleReturn >= 0) {
        // Upward trend: accelerating growth
        const trendFactor = Math.pow(progress, 0.8);
        baseValue =
          profile.startingValue +
          (profile.endingValue - profile.startingValue) * trendFactor;
      } else {
        // Downward trend: rapid initial drop, then stabilization
        const trendFactor = 1 - Math.pow(1 - progress, 0.7);
        baseValue =
          profile.startingValue +
          (profile.endingValue - profile.startingValue) * trendFactor;
      }

      // Add noise based on volatility
      const seed = agentId.charCodeAt(0) + i * 100;
      const noise =
        (seededRandom(seed) - 0.5) * 2 * profile.volatility * baseValue;
      const totalValue = Math.max(
        baseValue + noise,
        profile.startingValue * 0.2,
      );

      snapshots.push({
        agentId,
        competitionId: ctx.competitionId,
        timestamp,
        totalValue: Math.round(totalValue * 100) / 100,
      });
    }

    // Ensure last snapshot matches exact ending value
    if (snapshots.length > 0) {
      const lastIdx = snapshots.length - 1;
      const lastSnapshot = snapshots[lastIdx];
      if (lastSnapshot && lastSnapshot.agentId === agentId) {
        lastSnapshot.totalValue = profile.endingValue;
      }
    }
  }

  return snapshots;
}

function generateRiskMetricsSnapshots(ctx: CompetitionContext): Array<{
  agentId: string;
  competitionId: string;
  timestamp: Date;
  calmarRatio: string;
  sortinoRatio: string;
  simpleReturn: string;
  maxDrawdown: string;
  downsideDeviation: string;
  annualizedReturn: string;
}> {
  // Only for perps competitions
  if (ctx.competitionType !== "perpetual_futures") {
    return [];
  }

  const snapshots: Array<{
    agentId: string;
    competitionId: string;
    timestamp: Date;
    calmarRatio: string;
    sortinoRatio: string;
    simpleReturn: string;
    maxDrawdown: string;
    downsideDeviation: string;
    annualizedReturn: string;
  }> = [];

  const durationMs = ctx.endDate.getTime() - ctx.startDate.getTime();
  const intervalMs = 60 * 60 * 1000; // 1 hour intervals for risk metrics
  const numSnapshots = Math.max(Math.floor(durationMs / intervalMs), 5);

  for (const agent of ctx.agents) {
    const { agentId, profile } = agent;

    for (let i = 0; i <= numSnapshots; i++) {
      const progress = i / numSnapshots;
      const timestamp = new Date(
        ctx.startDate.getTime() + progress * durationMs,
      );

      // Metrics evolve over time toward final values
      const evolutionFactor = Math.pow(progress, 0.5);
      const seed = agentId.charCodeAt(0) + i * 50;
      const noise = (seededRandom(seed) - 0.5) * 0.2;

      const calmarRatio = profile.calmarRatio * evolutionFactor * (1 + noise);
      const sortinoRatio = profile.sortinoRatio * evolutionFactor * (1 + noise);
      const simpleReturn = profile.simpleReturn * evolutionFactor * (1 + noise);
      const maxDrawdown =
        profile.maxDrawdown * (0.5 + evolutionFactor * 0.5) * (1 + noise * 0.5);

      snapshots.push({
        agentId,
        competitionId: ctx.competitionId,
        timestamp,
        calmarRatio: String(Math.round(calmarRatio * 100) / 100),
        sortinoRatio: String(Math.round(sortinoRatio * 100) / 100),
        simpleReturn: String(Math.round(simpleReturn * 100) / 100),
        maxDrawdown: String(Math.round(maxDrawdown * 1000) / 1000),
        downsideDeviation: String(
          Math.round((0.02 + seededRandom(seed + 1) * 0.03) * 1000) / 1000,
        ),
        annualizedReturn: String(
          Math.round(simpleReturn * 12 * (1 + noise) * 100) / 100,
        ),
      });
    }
  }

  return snapshots;
}

interface GeneratedTrade {
  id: string;
  agentId: string;
  competitionId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  price: number;
  tradeAmountUsd: number;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  success: boolean;
  reason: string;
  timestamp: Date;
  fromChain: string;
  toChain: string;
  fromSpecificChain: string;
  toSpecificChain: string;
  tradeType: "simulated" | "spot_live";
  txHash: string;
  blockNumber: number;
  protocol: string;
  gasUsed: string;
  gasPrice: string;
  gasCostUsd: string;
}

function generateTrades(ctx: CompetitionContext): GeneratedTrade[] {
  // Only for non-perps competitions
  if (ctx.competitionType === "perpetual_futures") {
    return [];
  }

  const trades: GeneratedTrade[] = [];

  const durationMs = ctx.endDate.getTime() - ctx.startDate.getTime();
  const tradeType: "simulated" | "spot_live" =
    ctx.competitionType === "spot_live_trading" ? "spot_live" : "simulated";
  const ethPrice = 3500;

  for (let agentIdx = 0; agentIdx < ctx.agents.length; agentIdx++) {
    const agent = ctx.agents[agentIdx]!;
    const { agentId, profile } = agent;

    // Number of trades based on performance (active traders do more)
    const numTrades = 3 + Math.floor(seededRandom(agentIdx * 7) * 4);

    for (let i = 0; i < numTrades; i++) {
      const seed = agentId.charCodeAt(0) + i * 1000;
      const progress = (i + 0.5) / numTrades;
      const timeJitter = (seededRandom(seed) - 0.5) * 0.1;
      const actualProgress = Math.max(
        0.05,
        Math.min(0.95, progress + timeJitter),
      );
      const timestamp = new Date(
        ctx.startDate.getTime() + actualProgress * durationMs,
      );

      // Alternate between buy and sell
      const isBuy = i % 2 === 0;
      const fromToken = isBuy ? BASE_TOKENS.USDC : BASE_TOKENS.WETH;
      const toToken = isBuy ? BASE_TOKENS.WETH : BASE_TOKENS.USDC;
      const fromSymbol = isBuy ? "USDC" : "WETH";
      const toSymbol = isBuy ? "WETH" : "USDC";

      const tradeValueUsd =
        profile.startingValue * 0.1 * (0.5 + seededRandom(seed + 1));
      const fromAmount = isBuy ? tradeValueUsd : tradeValueUsd / ethPrice;
      const toAmount = isBuy ? tradeValueUsd / ethPrice : tradeValueUsd;
      const price = isBuy ? ethPrice : 1 / ethPrice;

      const secondsSinceStart =
        (timestamp.getTime() - ctx.startDate.getTime()) / 1000;
      const blockNumber = Math.floor(
        25000000 + secondsSinceStart * 2 + seededRandom(seed + 2) * 100,
      );

      trades.push({
        id: randomUUID(),
        agentId,
        competitionId: ctx.competitionId,
        fromToken,
        toToken,
        fromAmount: Math.round(fromAmount * 1000000) / 1000000,
        toAmount: Math.round(toAmount * 1000000) / 1000000,
        price,
        tradeAmountUsd: Math.round(tradeValueUsd * 100) / 100,
        fromTokenSymbol: fromSymbol,
        toTokenSymbol: toSymbol,
        success: true,
        reason: isBuy ? "Buying ETH" : "Selling ETH",
        timestamp,
        fromChain: "evm",
        toChain: "evm",
        fromSpecificChain: "base",
        toSpecificChain: "base",
        tradeType: tradeType as "simulated" | "spot_live",
        txHash: SAMPLE_TX_HASHES[(i + agentIdx) % SAMPLE_TX_HASHES.length]!,
        blockNumber,
        protocol: PROTOCOLS[(i + agentIdx) % PROTOCOLS.length]!,
        gasUsed: String(100000 + Math.floor(seededRandom(seed + 3) * 100000)),
        gasPrice: "1000000000",
        gasCostUsd: String(
          Math.round((0.1 + seededRandom(seed + 4) * 0.5) * 100) / 100,
        ),
      });
    }
  }

  return trades;
}

function generatePositions(ctx: CompetitionContext): Array<{
  id: string;
  agentId: string;
  competitionId: string;
  providerPositionId: string;
  providerTradeId: string;
  asset: string;
  isLong: boolean;
  leverage: string;
  positionSize: string;
  collateralAmount: string;
  entryPrice: string;
  currentPrice: string;
  liquidationPrice: string;
  pnlUsdValue: string;
  pnlPercentage: string;
  status: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  closedAt: Date | null;
}> {
  // Only for perps competitions
  if (ctx.competitionType !== "perpetual_futures") {
    return [];
  }

  const positions: Array<{
    id: string;
    agentId: string;
    competitionId: string;
    providerPositionId: string;
    providerTradeId: string;
    asset: string;
    isLong: boolean;
    leverage: string;
    positionSize: string;
    collateralAmount: string;
    entryPrice: string;
    currentPrice: string;
    liquidationPrice: string;
    pnlUsdValue: string;
    pnlPercentage: string;
    status: string;
    createdAt: Date;
    lastUpdatedAt: Date;
    closedAt: Date | null;
  }> = [];

  const assets = ["BTC", "ETH", "SOL", "ARB"];
  const durationMs = ctx.endDate.getTime() - ctx.startDate.getTime();
  const isEnded = ctx.competitionStatus === "ended";

  for (let agentIdx = 0; agentIdx < ctx.agents.length; agentIdx++) {
    const agent = ctx.agents[agentIdx]!;
    const { agentId, profile } = agent;

    // 3-5 positions per agent
    const numPositions = 3 + (agentIdx % 3);

    for (let i = 0; i < numPositions; i++) {
      const seed = agentId.charCodeAt(0) + i * 500 + agentIdx * 100;
      const asset = assets[i % assets.length]!;
      const assetPrice = ASSET_PRICES[asset] ?? 100;

      // Position timing
      const entryProgress = (i + 0.2) / (numPositions + 1);
      const entryTime = new Date(
        ctx.startDate.getTime() + entryProgress * durationMs * 0.7,
      );

      // Determine if position is closed
      const shouldClose = isEnded || i < numPositions - 1;
      const closeProgress = entryProgress + 0.1 + seededRandom(seed) * 0.2;
      const closeTime = shouldClose
        ? new Date(
            ctx.startDate.getTime() +
              Math.min(closeProgress, 0.95) * durationMs,
          )
        : null;

      // Position direction based on profile
      const isLong = profile.simpleReturn >= 0 ? i % 2 === 0 : i % 2 !== 0;
      const leverage = 3 + Math.floor(seededRandom(seed + 1) * 12);

      // Collateral and size
      const baseCollateral =
        500 * (0.8 + seededRandom(seed + 2) * 0.4) * (1 + agentIdx * 0.1);
      const positionSize = baseCollateral * leverage;

      // Prices
      const priceVariance = 1 + (seededRandom(seed + 3) - 0.5) * 0.1;
      const entryPrice = assetPrice * priceVariance;

      // PnL based on profile performance
      const pnlDirection = profile.simpleReturn >= 0 ? 1 : -1;
      const positionPnlPercent =
        (profile.simpleReturn / numPositions) *
        pnlDirection *
        (isLong ? 1 : -1) *
        (0.5 + seededRandom(seed + 4));

      const pnlMultiplier = isLong
        ? 1 + positionPnlPercent / 100 / leverage
        : 1 - positionPnlPercent / 100 / leverage;

      const currentPrice = shouldClose
        ? entryPrice * pnlMultiplier
        : assetPrice * (1 + (seededRandom(seed + 5) - 0.5) * 0.05);

      const actualPnlPercent = shouldClose
        ? positionPnlPercent * leverage
        : ((currentPrice - entryPrice) / entryPrice) *
          leverage *
          100 *
          (isLong ? 1 : -1);

      const pnlUsd = baseCollateral * (actualPnlPercent / 100);

      // Liquidation price
      const liquidationDistance = 1 / leverage;
      const liquidationPrice = isLong
        ? entryPrice * (1 - liquidationDistance * 0.9)
        : entryPrice * (1 + liquidationDistance * 0.9);

      positions.push({
        id: randomUUID(),
        agentId,
        competitionId: ctx.competitionId,
        providerPositionId: `pos_${randomUUID().slice(0, 8)}`,
        providerTradeId: `trade_${randomUUID().slice(0, 8)}`,
        asset,
        isLong,
        leverage: String(leverage),
        positionSize: String(Math.round(positionSize * 100) / 100),
        collateralAmount: String(Math.round(baseCollateral * 100) / 100),
        entryPrice: String(Math.round(entryPrice * 100) / 100),
        currentPrice: String(Math.round(currentPrice * 100) / 100),
        liquidationPrice: String(Math.round(liquidationPrice * 100) / 100),
        pnlUsdValue: String(Math.round(pnlUsd * 100) / 100),
        pnlPercentage: String(Math.round(actualPnlPercent * 100) / 100),
        status: shouldClose ? "Closed" : "Open",
        createdAt: entryTime,
        lastUpdatedAt: closeTime ?? new Date(),
        closedAt: closeTime,
      });
    }
  }

  return positions;
}

// ============================================================================
// Leaderboard Generation (for ended competitions)
// ============================================================================

interface LeaderboardEntry {
  baseEntry: {
    id: string;
    competitionId: string;
    agentId: string;
    rank: number;
    totalAgents: number;
    score: number;
  };
  perpsEntry?: {
    competitionsLeaderboardId: string;
    calmarRatio: number;
    sortinoRatio: number;
    simpleReturn: number;
    maxDrawdown: number;
    downsideDeviation: number;
    totalEquity: number;
    totalPnl: number;
    hasRiskMetrics: boolean;
  };
  spotLiveEntry?: {
    competitionsLeaderboardId: string;
    simpleReturn: number;
    pnl: number;
    startingValue: number;
    currentValue: number;
    totalTrades: number;
  };
  tradingEntry?: {
    competitionsLeaderboardId: string;
    pnl: number;
    startingValue: number;
  };
}

function generateLeaderboardEntries(
  ctx: CompetitionContext,
): LeaderboardEntry[] {
  if (ctx.competitionStatus !== "ended") {
    return [];
  }

  const entries: LeaderboardEntry[] = [];
  const totalAgents = ctx.agents.length;

  for (const agent of ctx.agents) {
    const { agentId, profile } = agent;
    const leaderboardId = randomUUID();
    const pnl = profile.endingValue - profile.startingValue;

    const baseEntry = {
      id: leaderboardId,
      competitionId: ctx.competitionId,
      agentId,
      rank: profile.rank,
      totalAgents,
      score: profile.endingValue,
    };

    const entry: LeaderboardEntry = { baseEntry };

    if (ctx.competitionType === "perpetual_futures") {
      entry.perpsEntry = {
        competitionsLeaderboardId: leaderboardId,
        calmarRatio: profile.calmarRatio,
        sortinoRatio: profile.sortinoRatio,
        simpleReturn: profile.simpleReturn,
        maxDrawdown: profile.maxDrawdown,
        downsideDeviation: 0.02 + Math.random() * 0.03,
        totalEquity: profile.endingValue,
        totalPnl: pnl,
        hasRiskMetrics: true,
      };
    } else if (ctx.competitionType === "spot_live_trading") {
      entry.spotLiveEntry = {
        competitionsLeaderboardId: leaderboardId,
        simpleReturn: profile.simpleReturn,
        pnl,
        startingValue: profile.startingValue,
        currentValue: profile.endingValue,
        totalTrades: Math.floor(5 + Math.random() * 20), // Random 5-25 trades
      };
    } else {
      entry.tradingEntry = {
        competitionsLeaderboardId: leaderboardId,
        pnl,
        startingValue: profile.startingValue,
      };
    }

    entries.push(entry);
  }

  return entries;
}

// ============================================================================
// Main Seeding Function
// ============================================================================

/**
 * Seed all competition data coherently.
 * This function handles snapshots, trades, positions, risk metrics, and leaderboards
 * in a unified way to ensure data consistency.
 */
export async function seedCompetitionData(
  db: NodePgDatabase<typeof schema>,
  competitionIds: string[],
): Promise<void> {
  log("Seeding competition data (unified)...");

  let totalSnapshots = 0;
  let totalRiskMetrics = 0;
  let totalTrades = 0;
  let totalPositions = 0;
  let totalLeaderboardEntries = 0;

  for (const competitionId of competitionIds) {
    // Get competition details from database
    const [competition] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.id, competitionId))
      .limit(1);

    if (!competition) {
      log(`Competition ${competitionId} not found, skipping`, "error");
      continue;
    }

    // Skip pending competitions
    if (competition.status === "pending") {
      log(`Competition ${competition.name} is pending, skipping data`, "info");
      continue;
    }

    // Get enrolled agents, sorted by ID for consistent ordering
    const enrolledAgents = await db
      .select({
        agentId: schema.competitionAgents.agentId,
      })
      .from(schema.competitionAgents)
      .where(eq(schema.competitionAgents.competitionId, competitionId))
      .orderBy(schema.competitionAgents.agentId);

    if (enrolledAgents.length === 0) {
      log(`No agents in ${competition.name}, skipping data`, "info");
      continue;
    }

    // Use actual competition dates from database
    const startDate = competition.startDate
      ? new Date(competition.startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const endDate =
      competition.status === "ended" && competition.endDate
        ? new Date(competition.endDate)
        : new Date();

    // Build context with consistent agent ordering and profiles
    const ctx: CompetitionContext = {
      competitionId,
      competitionName: competition.name,
      competitionType: competition.type,
      competitionStatus: competition.status,
      startDate,
      endDate,
      agents: enrolledAgents.map((a, index) => ({
        agentId: a.agentId,
        profile: getProfile(index),
      })),
    };

    log(
      `Processing ${competition.name} (${competition.type}, ${competition.status})...`,
    );

    // Generate and insert portfolio snapshots
    const snapshots = generatePortfolioSnapshots(ctx);
    if (snapshots.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
        const batch = snapshots.slice(i, i + BATCH_SIZE);
        await db
          .insert(schema.portfolioSnapshots)
          .values(batch)
          .onConflictDoNothing();
      }
      totalSnapshots += snapshots.length;
    }

    // Generate and insert risk metrics snapshots (perps only)
    const riskMetrics = generateRiskMetricsSnapshots(ctx);
    if (riskMetrics.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < riskMetrics.length; i += BATCH_SIZE) {
        const batch = riskMetrics.slice(i, i + BATCH_SIZE);
        await db
          .insert(schema.riskMetricsSnapshots)
          .values(batch)
          .onConflictDoNothing();
      }
      totalRiskMetrics += riskMetrics.length;
    }

    // Generate and insert trades (non-perps only)
    const trades = generateTrades(ctx);
    if (trades.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < trades.length; i += BATCH_SIZE) {
        const batch = trades.slice(i, i + BATCH_SIZE);
        await db.insert(schema.trades).values(batch).onConflictDoNothing();
      }
      totalTrades += trades.length;
    }

    // Generate and insert positions (perps only)
    const positions = generatePositions(ctx);
    if (positions.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < positions.length; i += BATCH_SIZE) {
        const batch = positions.slice(i, i + BATCH_SIZE);
        await db
          .insert(schema.perpetualPositions)
          .values(batch)
          .onConflictDoNothing();
      }
      totalPositions += positions.length;
    }

    // Generate and insert leaderboard entries (ended competitions only)
    const leaderboardEntries = generateLeaderboardEntries(ctx);
    if (leaderboardEntries.length > 0) {
      for (const entry of leaderboardEntries) {
        // Insert base leaderboard entry first
        await db
          .insert(schema.competitionsLeaderboard)
          .values(entry.baseEntry)
          .onConflictDoNothing();

        // Insert type-specific entry with the same ID
        if (entry.perpsEntry) {
          await db
            .insert(schema.perpsCompetitionsLeaderboard)
            .values(entry.perpsEntry)
            .onConflictDoNothing();
        } else if (entry.spotLiveEntry) {
          await db
            .insert(schema.spotLiveCompetitionsLeaderboard)
            .values(entry.spotLiveEntry)
            .onConflictDoNothing();
        } else if (entry.tradingEntry) {
          await db
            .insert(schema.tradingCompetitionsLeaderboard)
            .values(entry.tradingEntry)
            .onConflictDoNothing();
        }

        totalLeaderboardEntries++;
      }
    }

    log(
      `  ✓ ${competition.name}: ${snapshots.length} snapshots, ${riskMetrics.length} risk metrics, ${trades.length} trades, ${positions.length} positions, ${leaderboardEntries.length} leaderboard entries`,
      "success",
    );
  }

  log(`Seeding complete:`, "success");
  log(`  Portfolio snapshots: ${totalSnapshots}`);
  log(`  Risk metrics: ${totalRiskMetrics}`);
  log(`  Trades: ${totalTrades}`);
  log(`  Positions: ${totalPositions}`);
  log(`  Leaderboard entries: ${totalLeaderboardEntries}`);
}
