import { describe, expect, it } from "vitest";

import { calculateSlippage } from "../trade-utils.js";

describe("trade-utils", () => {
  describe("calculateSlippage", () => {
    it("should return zero slippage for zero USD value", () => {
      const result = calculateSlippage(0);
      expect(result.actualSlippage).toBe(0);
      expect(result.effectiveFromValueUSD).toBe(0);
      expect(result.slippagePercentage).toBe(0);
    });

    it("should apply minimal slippage for small trades", () => {
      const result = calculateSlippage(100); // $100 trade
      expect(result.actualSlippage).toBeGreaterThan(0);
      expect(result.actualSlippage).toBeLessThan(0.001); // Less than 0.1%
      expect(result.effectiveFromValueUSD).toBeGreaterThan(99);
      expect(result.effectiveFromValueUSD).toBeLessThan(100);
    });

    it("should apply moderate slippage for medium trades", () => {
      const result = calculateSlippage(10000); // $10k trade
      expect(result.actualSlippage).toBeGreaterThan(0.005); // More than 0.5%
      expect(result.actualSlippage).toBeLessThan(0.01); // Less than 1%
      expect(result.effectiveFromValueUSD).toBeGreaterThan(9900);
      expect(result.effectiveFromValueUSD).toBeLessThan(10000);
    });

    it("should never exceed maximum slippage for very large trades", () => {
      const testValues = [
        100000, // $100k
        1000000, // $1M
        10000000, // $10M
        100000000, // $100M
      ];

      for (const value of testValues) {
        const result = calculateSlippage(value);

        // Slippage should never exceed 15%
        expect(result.actualSlippage).toBeLessThanOrEqual(0.15);
        expect(result.slippagePercentage).toBeLessThanOrEqual(15);

        // Effective value should always be positive
        expect(result.effectiveFromValueUSD).toBeGreaterThan(0);
        expect(result.effectiveFromValueUSD).toBeGreaterThanOrEqual(
          value * 0.85,
        ); // At least 85% of original
      }
    });

    it("should produce consistent results with randomness bounds", () => {
      const tradeValue = 50000; // $50k trade
      const results: number[] = [];

      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const result = calculateSlippage(tradeValue);
        results.push(result.actualSlippage);
      }

      const minSlippage = Math.min(...results);
      const maxSlippage = Math.max(...results);

      // Check that randomness is within expected bounds (±10%)
      const expectedBase = 0.02 * Math.log10(1 + tradeValue / 10000);
      const expectedMin = expectedBase * 0.9;
      const expectedMax = Math.min(expectedBase * 1.1, 0.15);

      expect(minSlippage).toBeGreaterThanOrEqual(expectedMin * 0.99); // Allow for small floating point differences
      expect(maxSlippage).toBeLessThanOrEqual(expectedMax * 1.01);
    });

    it("should handle edge case of exactly $181,818 (old breaking point)", () => {
      // This was the value where the old formula would start producing > 100% slippage
      const result = calculateSlippage(181818.18);

      expect(result.actualSlippage).toBeLessThan(0.15); // Should be well under 15%
      expect(result.effectiveFromValueUSD).toBeGreaterThan(0); // Must be positive
      expect(result.effectiveFromValueUSD).toBeGreaterThan(181818.18 * 0.85); // At least 85% remains
    });

    it("should scale logarithmically, not linearly", () => {
      const trade1 = calculateSlippage(10000);
      const trade10x = calculateSlippage(100000);
      const trade100x = calculateSlippage(1000000);

      // With logarithmic scaling, 10x larger trade should have less than 10x slippage
      const ratio10x = trade10x.actualSlippage / trade1.actualSlippage;
      const ratio100x = trade100x.actualSlippage / trade10x.actualSlippage;

      expect(ratio10x).toBeLessThan(10);
      expect(ratio100x).toBeLessThan(10);

      // And the ratios should decrease (diminishing returns)
      expect(ratio100x).toBeLessThan(ratio10x);
    });

    it("should return reasonable slippage percentage values", () => {
      const testCases = [
        { value: 1000, maxPercentage: 1 },
        { value: 10000, maxPercentage: 5 },
        { value: 100000, maxPercentage: 10 },
        { value: 1000000, maxPercentage: 15 },
      ];

      for (const testCase of testCases) {
        const result = calculateSlippage(testCase.value);
        expect(result.slippagePercentage).toBeLessThanOrEqual(
          testCase.maxPercentage,
        );
        expect(result.slippagePercentage).toBe(result.actualSlippage * 100);
      }
    });
  });
});
