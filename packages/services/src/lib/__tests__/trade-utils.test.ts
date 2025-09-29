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
      expect(result.actualSlippage).toBeGreaterThanOrEqual(0.0005); // At least MIN_SLIPPAGE (5 bps)
      expect(result.actualSlippage).toBeLessThan(0.002); // Less than 0.2%
      expect(result.effectiveFromValueUSD).toBeGreaterThan(99.8);
      expect(result.effectiveFromValueUSD).toBeLessThan(100);
    });

    it("should apply moderate slippage for medium trades", () => {
      const result = calculateSlippage(10000); // $10k trade
      expect(result.actualSlippage).toBeGreaterThan(0.01); // More than 1%
      expect(result.actualSlippage).toBeLessThan(0.04); // Less than 4%
      expect(result.effectiveFromValueUSD).toBeGreaterThan(9600);
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

      // Formula uses K=0.035, SCALE=5000, and randomness [0.95, 1.20]
      const K = 0.035;
      const SCALE = 5000;
      const MIN_SLIPPAGE = 0.0005;
      const MAX_SLIPPAGE = 0.15;
      const expectedBase = Math.min(
        K * (Math.log1p(tradeValue / SCALE) / Math.LN10),
        0.15,
      );
      const expectedMin = Math.max(expectedBase * 0.95, MIN_SLIPPAGE); // MIN_SLIPPAGE floor
      const expectedMax = Math.min(expectedBase * 1.2, MAX_SLIPPAGE); // MAX_SLIPPAGE cap

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
        { value: 10000000, maxPercentage: 15 },
        { value: 100000000, maxPercentage: 15 },
        { value: 1000000000, maxPercentage: 15 },
        { value: 10000000000, maxPercentage: 15 },
        { value: 100000000000, maxPercentage: 15 },
        { value: 1000000000000, maxPercentage: 15 },
        { value: 10000000000000, maxPercentage: 15 },
        { value: Number.MAX_SAFE_INTEGER, maxPercentage: 15 },
        { value: Number.MAX_VALUE, maxPercentage: 15 },
        { value: Number.MIN_VALUE, maxPercentage: 15 },
      ];

      for (const testCase of testCases) {
        const result = calculateSlippage(testCase.value);
        expect(result.slippagePercentage).toBeLessThanOrEqual(
          testCase.maxPercentage,
        );
        expect(result.slippagePercentage).toBe(result.actualSlippage * 100);
      }
    });

    it("should handle negative and non-finite values", () => {
      expect(() => calculateSlippage(-1)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(NaN)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(Infinity)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(-Infinity)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(Number.MIN_SAFE_INTEGER)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(Number.NEGATIVE_INFINITY)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(Number.POSITIVE_INFINITY)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
      expect(() => calculateSlippage(Number.NaN)).toThrow(
        "fromValueUSD must be a finite, non-negative number",
      );
    });
  });
});
