import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PriceTracker } from "@/services/price-tracker.service.js";
import { BlockchainType } from "@/types/index.js";

// Trading constraint constants (matching TradeSimulator)
const MINIMUM_PAIR_AGE_HOURS = 168; // 7 days
const MINIMUM_24H_VOLUME_USD = 100000; // $100,000
const MINIMUM_LIQUIDITY_USD = 100000; // $100,000
const MINIMUM_FDV_USD = 1000000; // $1,000,000

describe("TradeSimulator - Trading Constraints Integration", () => {
  let priceTracker: PriceTracker;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let originalConsoleLog: any;

  // Test tokens with different characteristics
  const testTokens = [
    {
      name: "WETH (Ethereum)",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      chain: BlockchainType.EVM,
      specificChain: "eth",
      expectedToPass: true,
      description: "Major token - should pass all constraints",
    },
    {
      name: "USDC (Ethereum)",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chain: BlockchainType.EVM,
      specificChain: "eth",
      expectedToPass: true,
      description: "Stablecoin - should pass all constraints",
    },
    {
      name: "PEPE (Ethereum)",
      address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      chain: BlockchainType.EVM,
      specificChain: "eth",
      expectedToPass: true,
      description: "Popular meme token - likely to pass constraints",
    },
    {
      name: "SOL (Solana)",
      address: "So11111111111111111111111111111111111111112",
      chain: BlockchainType.SVM,
      specificChain: "svm",
      expectedToPass: true,
      description: "SOL native token - test for FDV availability",
    },
  ];

  beforeAll(() => {
    // Keep console logging for SOL test
    originalConsoleLog = console.log;
    // Don't mock console.log so we can see the constraint data

    priceTracker = new PriceTracker();
  });

  afterAll(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });

  describe("Real Token Constraint Validation", () => {
    it.each(testTokens)(
      "should validate constraints for $name",
      async (token) => {
        const priceData = await priceTracker.getPrice(
          token.address,
          token.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.specificChain as any,
        );

        // Skip test if price data is not available
        if (!priceData) {
          console.warn(`Skipping ${token.name} - no price data available`);
          return;
        }

        expect(priceData.price).toBeGreaterThan(0);
        expect(priceData.symbol).toBeTruthy();

        // Log token information for debugging
        console.log(`\n--- ${token.name} Constraint Analysis ---`);
        console.log(`Price: $${priceData.price}`);
        console.log(`Symbol: ${priceData.symbol}`);

        // Check individual constraints
        let constraintsPassed = 0;
        let constraintsFailed = 0;

        // 1. Pair age constraint
        if (priceData.pairCreatedAt) {
          const pairAgeHours =
            (Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60);
          const passesAgeCheck = pairAgeHours > MINIMUM_PAIR_AGE_HOURS;
          console.log(
            `Pair Age: ${pairAgeHours.toFixed(2)} hours ${passesAgeCheck ? "✅" : "❌"}`,
          );

          if (passesAgeCheck) constraintsPassed++;
          else constraintsFailed++;
        } else {
          console.log(`Pair Age: N/A ❌`);
          constraintsFailed++;
        }

        // 2. Volume constraint
        if (priceData.volume?.h24) {
          const passesVolumeCheck =
            priceData.volume.h24 > MINIMUM_24H_VOLUME_USD;
          console.log(
            `24h Volume: $${priceData.volume.h24.toLocaleString()} ${passesVolumeCheck ? "✅" : "❌"} (min: $${MINIMUM_24H_VOLUME_USD.toLocaleString()})`,
          );

          if (passesVolumeCheck) constraintsPassed++;
          else constraintsFailed++;
        } else {
          console.log(`24h Volume: N/A ❌`);
          constraintsFailed++;
        }

        // 3. Liquidity constraint
        if (priceData.liquidity?.usd) {
          const passesLiquidityCheck =
            priceData.liquidity.usd > MINIMUM_LIQUIDITY_USD;
          console.log(
            `Liquidity: $${priceData.liquidity.usd.toLocaleString()} ${passesLiquidityCheck ? "✅" : "❌"}`,
          );

          if (passesLiquidityCheck) constraintsPassed++;
          else constraintsFailed++;
        } else {
          console.log(`Liquidity: N/A ❌`);
          constraintsFailed++;
        }

        // 4. FDV constraint
        if (priceData.fdv) {
          const passesFdvCheck = priceData.fdv > MINIMUM_FDV_USD;
          console.log(
            `FDV: $${priceData.fdv.toLocaleString()} ${passesFdvCheck ? "✅" : "❌"}`,
          );

          if (passesFdvCheck) constraintsPassed++;
          else constraintsFailed++;
        } else {
          console.log(`FDV: N/A ❌`);
          constraintsFailed++;
        }

        // Overall assessment
        const allConstraintsMet = constraintsFailed === 0;
        console.log(
          `Overall: ${allConstraintsMet ? "TRADEABLE ✅" : "NOT TRADEABLE ❌"}`,
        );
        console.log(
          `Constraints passed: ${constraintsPassed}/4, failed: ${constraintsFailed}/4`,
        );

        // For major tokens, we expect them to pass most constraints
        if (token.expectedToPass) {
          expect(constraintsPassed).toBeGreaterThan(constraintsFailed);
        }

        // Verify data structure
        expect(priceData).toHaveProperty("token");
        expect(priceData).toHaveProperty("price");
        expect(priceData).toHaveProperty("symbol");
        expect(priceData).toHaveProperty("timestamp");
        expect(priceData).toHaveProperty("chain");
        expect(priceData).toHaveProperty("specificChain");
      },
      30000,
    ); // 30 second timeout for API calls
  });

  describe("Constraint Boundary Testing", () => {
    it("should handle edge cases in constraint validation", async () => {
      // Test with a well-known token to verify edge case handling
      const priceData = await priceTracker.getPrice(
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        BlockchainType.EVM,
        "eth",
      );

      if (!priceData) {
        console.warn("Skipping edge case test - no price data available");
        return;
      }

      // Test boundary conditions
      if (priceData.pairCreatedAt) {
        const pairAgeHours =
          (Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60);

        // For established tokens like WETH, pair age should be well above minimum
        expect(pairAgeHours).toBeGreaterThan(MINIMUM_PAIR_AGE_HOURS * 10);
      }

      if (priceData.volume?.h24) {
        // For major tokens, volume should be well above minimum
        expect(priceData.volume.h24).toBeGreaterThan(
          MINIMUM_24H_VOLUME_USD * 10,
        );
      }

      if (priceData.liquidity?.usd) {
        // For major tokens, liquidity should be well above minimum
        expect(priceData.liquidity.usd).toBeGreaterThan(
          MINIMUM_LIQUIDITY_USD * 10,
        );
      }

      if (priceData.fdv) {
        // For major tokens, FDV should be well above minimum
        expect(priceData.fdv).toBeGreaterThan(MINIMUM_FDV_USD * 10);
      }
    }, 30000);
  });

  describe("Price Data Structure Validation", () => {
    it("should return properly structured price data with constraint fields", async () => {
      const priceData = await priceTracker.getPrice(
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        BlockchainType.EVM,
        "eth",
      );

      if (!priceData) {
        console.warn("Skipping structure test - no price data available");
        return;
      }

      // Verify core fields
      expect(priceData).toHaveProperty("token");
      expect(priceData).toHaveProperty("price");
      expect(priceData).toHaveProperty("symbol");
      expect(priceData).toHaveProperty("timestamp");
      expect(priceData).toHaveProperty("chain");
      expect(priceData).toHaveProperty("specificChain");

      // Verify constraint fields are present (even if undefined)
      expect(priceData).toHaveProperty("pairCreatedAt");
      expect(priceData).toHaveProperty("volume");
      expect(priceData).toHaveProperty("liquidity");
      expect(priceData).toHaveProperty("fdv");

      // Verify types
      expect(typeof priceData.price).toBe("number");
      expect(typeof priceData.symbol).toBe("string");
      expect(priceData.timestamp).toBeInstanceOf(Date);
      expect(typeof priceData.chain).toBe("string");
      expect(typeof priceData.specificChain).toBe("string");

      // Verify constraint field types (when present)
      if (priceData.pairCreatedAt !== undefined) {
        expect(typeof priceData.pairCreatedAt).toBe("number");
      }

      if (priceData.volume !== undefined) {
        expect(typeof priceData.volume).toBe("object");
        if (priceData.volume.h24 !== undefined) {
          expect(typeof priceData.volume.h24).toBe("number");
        }
      }

      if (priceData.liquidity !== undefined) {
        expect(typeof priceData.liquidity).toBe("object");
        if (priceData.liquidity.usd !== undefined) {
          expect(typeof priceData.liquidity.usd).toBe("number");
        }
      }

      if (priceData.fdv !== undefined) {
        expect(typeof priceData.fdv).toBe("number");
      }
    }, 30000);
  });

  describe("Multi-Chain Constraint Support", () => {
    it("should validate constraints across different chains", async () => {
      const chainTokens = [
        {
          name: "WETH (Ethereum)",
          address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          chain: BlockchainType.EVM,
          specificChain: "eth",
        },
        {
          name: "USDC (Polygon)",
          address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          chain: BlockchainType.EVM,
          specificChain: "polygon",
        },
        {
          name: "USDC (Base)",
          address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
          chain: BlockchainType.EVM,
          specificChain: "base",
        },
      ];

      for (const token of chainTokens) {
        const priceData = await priceTracker.getPrice(
          token.address,
          token.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.specificChain as any,
        );

        if (!priceData) {
          console.warn(`Skipping ${token.name} - no price data available`);
          continue;
        }

        // Verify chain information is correctly set
        expect(priceData.chain).toBe(token.chain);
        expect(priceData.specificChain).toBe(token.specificChain);

        // Verify constraint fields are present
        expect(priceData).toHaveProperty("pairCreatedAt");
        expect(priceData).toHaveProperty("volume");
        expect(priceData).toHaveProperty("liquidity");
        expect(priceData).toHaveProperty("fdv");

        console.log(
          `${token.name} - Chain: ${priceData.chain}, Specific: ${priceData.specificChain}`,
        );
      }
    }, 45000); // Longer timeout for multiple API calls
  });
});
