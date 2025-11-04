import { z } from "zod/v4";

import {
  CrossChainTradingTypeSchema,
  EvaluationMetricSchema,
  TradingConstraintsSchema,
} from "../types/index.js";

/**
 * Arena Config Validators
 * Based on: https://www.notion.so/Arena-Config-v1-Fields-Types-Purpose-294dfc9427de8088a0bad74538624ae7
 */

/**
 * Base arena config schema
 */
export const ArenaConfigSchema = z
  .object({
    apiVersion: z.literal("arenas.recall/v1"),
    kind: z.literal("Competition"),
    metadata: z.object({
      id: z
        .string()
        .regex(
          /^[a-z0-9-]+$/,
          "ID must be lowercase kebab-case (e.g., 'spot-sharpe-aero-2025w44')",
        ),
      name: z.string().min(4).max(80),
      createdBy: z.string(),
    }),
    classification: z.object({
      category: z.enum(["crypto_trading"]),
      skill: z.string(),
      venues: z.array(z.string()).optional(),
      chains: z.array(z.string()).optional(),
    }),
    schedule: z
      .object({
        registration: z.object({
          opensAt: z.coerce.date(),
          closesAt: z.coerce.date(),
        }),
        runs: z.object({
          startAt: z.coerce.date(),
          endAt: z.coerce.date(),
          lateJoinPolicy: z
            .enum(["from_join_to_end", "entire_window"])
            .optional(),
        }),
        boosting: z
          .object({
            startAt: z.coerce.date(),
            endAt: z.coerce.date(),
          })
          .optional(),
      })
      .optional(),
    participation: z.object({
      maxAgents: z.number().int().min(1).optional(),
      vips: z.array(z.string()).optional(),
      allowlist: z.array(z.string()).optional(),
      blocklist: z.array(z.string()).optional(),
      requirements: z
        .object({
          minStake: z.number().min(0).optional(),
          recallRank: z.number().optional(),
          allowlistOnly: z.boolean().optional(),
        })
        .optional(),
    }),
    engine: z.object({
      id: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be valid semver"),
      description: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
      params: z.record(z.string(), z.unknown()).optional(),
    }),
    partners: z
      .array(
        z.object({
          position: z.number().int().min(1),
          name: z.string().min(1).max(40),
          url: z.string().url().optional(),
          details: z.string().max(140).optional(),
          logo_url: z.string().url().optional(),
        }),
      )
      .optional(),
    rewards: z
      .object({
        agentAllocation: z.number().min(0).optional(),
        agentAllocationUnit: z.string().optional(),
        boosterAllocation: z.number().min(0).optional(),
        boosterAllocationUnit: z.string().optional(),
        rules: z.string().optional(),
        details: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.schedule?.registration) {
        return (
          data.schedule.registration.opensAt <=
          data.schedule.registration.closesAt
        );
      }
      return true;
    },
    {
      message: "registration.opensAt must be before or equal to closesAt",
      path: ["schedule", "registration", "opensAt"],
    },
  )
  .refine(
    (data) => {
      if (data.schedule?.runs) {
        return data.schedule.runs.startAt <= data.schedule.runs.endAt;
      }
      return true;
    },
    {
      message: "runs.startAt must be before or equal to endAt",
      path: ["schedule", "runs", "startAt"],
    },
  )
  .refine(
    (data) => {
      if (data.schedule?.boosting) {
        return data.schedule.boosting.startAt <= data.schedule.boosting.endAt;
      }
      return true;
    },
    {
      message: "boosting.startAt must be before or equal to endAt",
      path: ["schedule", "boosting", "startAt"],
    },
  );

/**
 * Spot paper trading engine params schema
 */
export const SpotPaperTradingEngineParamsSchema = z.object({
  crossChainTradingType: CrossChainTradingTypeSchema.optional(),
  tradingConstraints: TradingConstraintsSchema.optional(),
  priceProvider: z.enum(["dexscreener", "coingecko"]).optional(),
});

/**
 * Perpetual futures engine params schema
 */
export const PerpetualFuturesEngineParamsSchema = z.object({
  provider: z.enum(["symphony", "hyperliquid"]),
  evaluationMetric: EvaluationMetricSchema.optional(),
  initialCapital: z.number().positive(),
  selfFundingThreshold: z.number().min(0),
  minFundingThreshold: z.number().min(0).optional(),
  apiUrl: z.string().url().optional(),
  dataSource: z
    .enum(["external_api", "onchain_indexing", "hybrid"])
    .default("external_api"),
  dataSourceConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Spot live trading engine params schema
 */
export const SpotLiveTradingEngineParamsSchema = z.object({
  dataSource: z.literal("rpc_direct"), // Only RPC scanning supported (can add external_api when built)
  provider: z.string(), // RPC provider (e.g., "alchemy", "quicknode")
  chains: z.array(z.string()),
  enableProtocolFilter: z.boolean().default(false),
  enableTokenWhitelist: z.boolean().default(false),
  selfFundingThresholdUsd: z.number().min(0),
  minFundingThreshold: z.number().min(0),
  scanIntervalSeconds: z.number().int().min(60).optional(),
});

/**
 * Type for validated arena config
 */
export type ArenaConfig = z.infer<typeof ArenaConfigSchema>;

/**
 * Validate arena config and engine-specific params
 * @param config The arena config to validate
 * @returns Validated config with typed engine params
 */
export function validateArenaConfig(config: unknown): ArenaConfig {
  // Validate base structure
  const validated = ArenaConfigSchema.parse(config);

  // Validate engine-specific params based on engine.id
  if (validated.engine.params) {
    switch (validated.engine.id) {
      case "spot_paper_trading":
        validated.engine.params = SpotPaperTradingEngineParamsSchema.parse(
          validated.engine.params,
        );
        break;

      case "perpetual_futures":
        validated.engine.params = PerpetualFuturesEngineParamsSchema.parse(
          validated.engine.params,
        );
        break;

      case "spot_live_trading":
        validated.engine.params = SpotLiveTradingEngineParamsSchema.parse(
          validated.engine.params,
        );
        break;

      default:
        throw new Error(
          `Unknown engine ID: ${validated.engine.id}. Supported engines: spot_paper_trading, perpetual_futures, spot_live_trading`,
        );
    }
  }

  return validated;
}

/**
 * Validate only engine params (for partial updates)
 * @param engineId The engine identifier
 * @param params The params to validate
 * @returns Validated params
 */
export function validateEngineParams(
  engineId: string,
  params: unknown,
): Record<string, unknown> {
  switch (engineId) {
    case "spot_paper_trading":
      return SpotPaperTradingEngineParamsSchema.parse(params);

    case "perpetual_futures":
      return PerpetualFuturesEngineParamsSchema.parse(params);

    case "spot_live_trading":
      return SpotLiveTradingEngineParamsSchema.parse(params);

    default:
      throw new Error(`Unknown engine ID: ${engineId}`);
  }
}
