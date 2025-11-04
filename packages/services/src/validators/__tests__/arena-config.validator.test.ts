import { describe, expect, test } from "vitest";

import {
  ArenaConfigSchema,
  PerpetualFuturesEngineParamsSchema,
  SpotLiveTradingEngineParamsSchema,
  SpotPaperTradingEngineParamsSchema,
  validateArenaConfig,
  validateEngineParams,
} from "../arena-config.validator.js";

describe("ArenaConfigSchema", () => {
  test("should validate valid arena config", () => {
    const validConfig = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "test-arena-2025w44",
        name: "Test Arena",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "paper_trading",
      },
      participation: {},
      engine: {
        id: "spot_paper_trading",
        version: "1.0.0",
      },
    };

    expect(() => ArenaConfigSchema.parse(validConfig)).not.toThrow();
  });

  test("should reject invalid apiVersion", () => {
    const invalidConfig = {
      apiVersion: "v2",
      kind: "Competition",
      metadata: { id: "test", name: "Test", createdBy: "recall" },
      classification: { category: "crypto_trading", skill: "test" },
      participation: {},
      engine: { id: "spot_paper_trading", version: "1.0.0" },
    };

    expect(() => ArenaConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("should reject invalid kind", () => {
    const invalidConfig = {
      apiVersion: "arenas.recall/v1",
      kind: "Tournament",
      metadata: { id: "test", name: "Test", createdBy: "recall" },
      classification: { category: "crypto_trading", skill: "test" },
      participation: {},
      engine: { id: "spot_paper_trading", version: "1.0.0" },
    };

    expect(() => ArenaConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("should reject invalid metadata.id format", () => {
    const invalidConfig = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "Test Arena 2025",
        name: "Test",
        createdBy: "recall",
      },
      classification: { category: "crypto_trading", skill: "test" },
      participation: {},
      engine: { id: "spot_paper_trading", version: "1.0.0" },
    };

    expect(() => ArenaConfigSchema.parse(invalidConfig)).toThrow(
      /lowercase kebab-case/,
    );
  });

  test("should validate schedule dates", () => {
    const validConfig = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: { id: "test", name: "Test", createdBy: "recall" },
      classification: { category: "crypto_trading", skill: "test" },
      participation: {},
      engine: { id: "spot_paper_trading", version: "1.0.0" },
      schedule: {
        registration: {
          opensAt: new Date("2025-01-01"),
          closesAt: new Date("2025-01-02"),
        },
        runs: {
          startAt: new Date("2025-01-03"),
          endAt: new Date("2025-01-10"),
        },
      },
    };

    expect(() => ArenaConfigSchema.parse(validConfig)).not.toThrow();
  });

  test("should reject invalid registration dates", () => {
    const invalidConfig = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: { id: "test", name: "Test", createdBy: "recall" },
      classification: { category: "crypto_trading", skill: "test" },
      participation: {},
      engine: { id: "spot_paper_trading", version: "1.0.0" },
      schedule: {
        registration: {
          opensAt: new Date("2025-01-02"),
          closesAt: new Date("2025-01-01"),
        },
        runs: {
          startAt: new Date("2025-01-03"),
          endAt: new Date("2025-01-10"),
        },
      },
    };

    expect(() => ArenaConfigSchema.parse(invalidConfig)).toThrow(
      /opensAt must be before/,
    );
  });
});

describe("SpotPaperTradingEngineParamsSchema", () => {
  test("should validate valid spot paper trading params", () => {
    const validParams = {
      crossChainTradingType: "disallowAll",
      tradingConstraints: {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 50000,
        minimumLiquidityUsd: 25000,
        minimumFdvUsd: 100000,
      },
      priceProvider: "dexscreener",
    };

    expect(() =>
      SpotPaperTradingEngineParamsSchema.parse(validParams),
    ).not.toThrow();
  });

  test("should allow empty params", () => {
    expect(() => SpotPaperTradingEngineParamsSchema.parse({})).not.toThrow();
  });

  test("should reject invalid crossChainTradingType", () => {
    const invalidParams = {
      crossChainTradingType: "invalid",
    };

    expect(() =>
      SpotPaperTradingEngineParamsSchema.parse(invalidParams),
    ).toThrow();
  });
});

describe("PerpetualFuturesEngineParamsSchema", () => {
  test("should validate valid perps params", () => {
    const validParams = {
      provider: "symphony",
      evaluationMetric: "calmar_ratio",
      initialCapital: 500,
      selfFundingThreshold: 10,
      minFundingThreshold: 100,
      apiUrl: "https://api.symphony.finance/v1",
    };

    expect(() =>
      PerpetualFuturesEngineParamsSchema.parse(validParams),
    ).not.toThrow();
  });

  test("should require provider and thresholds", () => {
    const invalidParams = {
      initialCapital: 500,
    };

    expect(() =>
      PerpetualFuturesEngineParamsSchema.parse(invalidParams),
    ).toThrow();
  });

  test("should reject negative initialCapital", () => {
    const invalidParams = {
      provider: "symphony",
      initialCapital: -100,
      selfFundingThreshold: 10,
    };

    expect(() =>
      PerpetualFuturesEngineParamsSchema.parse(invalidParams),
    ).toThrow();
  });
});

describe("SpotLiveTradingEngineParamsSchema", () => {
  test("should validate valid spot live params", () => {
    const validParams = {
      dataSource: "rpc_direct",
      provider: "alchemy",
      chains: ["base", "arbitrum"],
      enableProtocolFilter: true,
      enableTokenWhitelist: false,
      selfFundingThresholdUsd: 50,
      minFundingThreshold: 100,
    };

    expect(() =>
      SpotLiveTradingEngineParamsSchema.parse(validParams),
    ).not.toThrow();
  });

  test("should apply default values for optional boolean fields", () => {
    const paramsWithoutDefaults = {
      dataSource: "rpc_direct" as const,
      provider: "alchemy",
      chains: ["base"],
      selfFundingThresholdUsd: 50,
      minFundingThreshold: 100,
    };

    const result = SpotLiveTradingEngineParamsSchema.parse(
      paramsWithoutDefaults,
    );

    // Defaults should be applied
    expect(result.enableProtocolFilter).toBe(false);
    expect(result.enableTokenWhitelist).toBe(false);
  });

  test("should require dataSource and chains", () => {
    const invalidParams = {
      provider: "alchemy",
    };

    expect(() =>
      SpotLiveTradingEngineParamsSchema.parse(invalidParams),
    ).toThrow();
  });
});

describe("validateArenaConfig", () => {
  test("should validate spot paper trading arena config end-to-end", () => {
    const config = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "spot-paper-test-2025w44",
        name: "Spot Paper Trading Test",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "spot_paper_trading",
      },
      participation: {
        maxAgents: 100,
      },
      engine: {
        id: "spot_paper_trading",
        version: "1.0.0",
        params: {
          crossChainTradingType: "disallowAll",
          tradingConstraints: {
            minimumPairAgeHours: 24,
            minimum24hVolumeUsd: 50000,
            minimumLiquidityUsd: 25000,
            minimumFdvUsd: 100000,
          },
        },
      },
    };

    expect(() => validateArenaConfig(config)).not.toThrow();
  });

  test("should validate perps arena config end-to-end", () => {
    const config = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "perps-symphony-2025w44",
        name: "Perps Symphony Test",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "perpetual_futures",
      },
      participation: {},
      engine: {
        id: "perpetual_futures",
        version: "1.0.0",
        params: {
          provider: "symphony",
          initialCapital: 500,
          selfFundingThreshold: 10,
          evaluationMetric: "calmar_ratio",
        },
      },
    };

    expect(() => validateArenaConfig(config)).not.toThrow();
  });

  test("should reject unknown engine ID", () => {
    const config = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "unknown-engine",
        name: "Unknown Engine",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "unknown",
      },
      participation: {},
      engine: {
        id: "unknown_engine_type",
        version: "1.0.0",
        params: {},
      },
    };

    expect(() => validateArenaConfig(config)).toThrow(/Invalid input/);
  });

  test("should reject invalid engine params", () => {
    const config = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "perps-invalid",
        name: "Invalid Perps",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "perpetual_futures",
      },
      participation: {},
      engine: {
        id: "perpetual_futures",
        version: "1.0.0",
        params: {
          // Missing required provider and thresholds
          initialCapital: 500,
        },
      },
    };

    expect(() => validateArenaConfig(config)).toThrow();
  });
});

describe("validateEngineParams", () => {
  test("should validate spot paper trading params", () => {
    const params = {
      crossChainTradingType: "allow",
    };

    expect(() =>
      validateEngineParams("spot_paper_trading", params),
    ).not.toThrow();
  });

  test("should validate perps params", () => {
    const params = {
      provider: "hyperliquid",
      initialCapital: 1000,
      selfFundingThreshold: 20,
    };

    expect(() =>
      validateEngineParams("perpetual_futures", params),
    ).not.toThrow();
  });

  test("should reject unknown engine", () => {
    expect(() => validateEngineParams("unknown", {})).toThrow(
      /Unknown engine ID/,
    );
  });

  test("should apply engine param defaults through validateArenaConfig", () => {
    const config = {
      apiVersion: "arenas.recall/v1",
      kind: "Competition",
      metadata: {
        id: "test-defaults",
        name: "Test Defaults",
        createdBy: "recall",
      },
      classification: {
        category: "crypto_trading",
        skill: "spot_live_trading",
      },
      participation: {},
      engine: {
        id: "spot_live_trading",
        version: "1.0.0",
        params: {
          dataSource: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
          selfFundingThresholdUsd: 50,
          minFundingThreshold: 100,
          // Missing enableProtocolFilter and enableTokenWhitelist - should default to false
        },
      },
    };

    const result = validateArenaConfig(config);

    // Defaults should be applied and returned
    expect(result.engine.id).toBe("spot_live_trading");
    if (result.engine.id === "spot_live_trading") {
      expect(result.engine.params).toBeDefined();
      expect(result.engine.params?.enableProtocolFilter).toBe(false);
      expect(result.engine.params?.enableTokenWhitelist).toBe(false);
    }
  });
});
