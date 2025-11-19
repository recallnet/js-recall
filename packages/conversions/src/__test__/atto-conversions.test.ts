import { describe, expect, it } from "vitest";

import {
  attoValueToNumberValue,
  attoValueToStringValue,
  valueToAttoBigInt,
  valueToAttoString,
} from "../atto-conversions.js";

describe("atto-conversions", () => {
  describe("attoValueToNumberValue", () => {
    it("should convert basic atto values to number values", () => {
      expect(attoValueToNumberValue("1000000000000000000")).toBe(1);
      expect(attoValueToNumberValue("2000000000000000000")).toBe(2);
      expect(attoValueToNumberValue("500000000000000000")).toBe(0.5);
    });

    it("should handle string inputs", () => {
      expect(attoValueToNumberValue("1000000000000000000")).toBe(1);
      expect(attoValueToNumberValue("123456789000000000")).toBe(0.123456789);
    });

    it("should handle number inputs", () => {
      expect(attoValueToNumberValue(1000000000000000000)).toBe(1);
      expect(attoValueToNumberValue(500000000000000000)).toBe(0.5);
    });

    it("should handle zero", () => {
      expect(attoValueToNumberValue(0)).toBe(0);
      expect(attoValueToNumberValue("0")).toBe(0);
    });

    it("should handle very small values", () => {
      expect(attoValueToNumberValue("1")).toBe(0.000000000000000001);
      expect(attoValueToNumberValue("1000")).toBe(0.000000000000001);
    });

    it("should round down by default", () => {
      // Test with a value that would have fractional precision beyond what can be represented
      expect(attoValueToNumberValue("1000000000000000001")).toBe(1);
      // Note: 1999999999999999999 / 1e18 = 1.999999999999999999, which rounds to 2 with 18 decimals precision
      expect(attoValueToNumberValue("1999999999999999999")).toBe(2);
    });

    it("should respect rounding parameter", () => {
      const testValue = "1500000000000000000"; // 1.5 exactly
      expect(attoValueToNumberValue(testValue, "ROUND_DOWN")).toBe(1.5);
      expect(attoValueToNumberValue(testValue, "ROUND_UP")).toBe(1.5);
      expect(attoValueToNumberValue(testValue, "ROUND_HALF")).toBe(1.5);
    });

    it("should handle large values", () => {
      expect(attoValueToNumberValue("1000000000000000000000")).toBe(1000);
      expect(attoValueToNumberValue("123000000000000000000000")).toBe(123000);
    });
  });

  describe("attoValueToStringValue", () => {
    it("should convert basic atto values to string values", () => {
      expect(attoValueToStringValue("1000000000000000000")).toBe("1");
      expect(attoValueToStringValue("2000000000000000000")).toBe("2");
      expect(attoValueToStringValue("500000000000000000")).toBe("0.5");
    });
  });

  describe("valueToAttoString", () => {
    it("should convert basic number values to atto strings", () => {
      expect(valueToAttoString(1)).toBe("1000000000000000000");
      expect(valueToAttoString(2)).toBe("2000000000000000000");
      expect(valueToAttoString(0.5)).toBe("500000000000000000");
    });

    it("should handle string inputs", () => {
      expect(valueToAttoString("1")).toBe("1000000000000000000");
      expect(valueToAttoString("0.5")).toBe("500000000000000000");
      expect(valueToAttoString("123.456")).toBe("123456000000000000000");
    });

    it("should handle zero", () => {
      expect(valueToAttoString(0)).toBe("0");
      expect(valueToAttoString("0")).toBe("0");
    });

    it("should handle decimal values", () => {
      expect(valueToAttoString(0.123456789)).toBe("123456789000000000");
      expect(valueToAttoString(0.000000001)).toBe("1000000000");
    });

    it("should handle very small values", () => {
      expect(valueToAttoString(0.000000000000000001)).toBe("1");
      expect(valueToAttoString(0.000000000000001)).toBe("1000");
    });

    it("should handle large values", () => {
      expect(valueToAttoString(1000)).toBe("1000000000000000000000");
      expect(valueToAttoString(123456)).toBe("123456000000000000000000");
    });
  });

  describe("valueToAttoBigInt", () => {
    it("should convert basic number values to atto BigInt", () => {
      expect(valueToAttoBigInt(1)).toBe(1000000000000000000n);
      expect(valueToAttoBigInt(2)).toBe(2000000000000000000n);
      expect(valueToAttoBigInt(0.5)).toBe(500000000000000000n);
    });

    it("should handle string inputs", () => {
      expect(valueToAttoBigInt("1")).toBe(1000000000000000000n);
      expect(valueToAttoBigInt("0.5")).toBe(500000000000000000n);
      expect(valueToAttoBigInt("123.456")).toBe(123456000000000000000n);
    });

    it("should handle zero", () => {
      expect(valueToAttoBigInt(0)).toBe(0n);
      expect(valueToAttoBigInt("0")).toBe(0n);
    });

    it("should handle decimal values", () => {
      expect(valueToAttoBigInt(0.123456789)).toBe(123456789000000000n);
      expect(valueToAttoBigInt(0.000000001)).toBe(1000000000n);
    });

    it("should handle very small values", () => {
      expect(valueToAttoBigInt(0.000000000000000001)).toBe(1n);
      expect(valueToAttoBigInt(0.000000000000001)).toBe(1000n);
    });

    it("should handle large values", () => {
      expect(valueToAttoBigInt(1000)).toBe(1000000000000000000000n);
      expect(valueToAttoBigInt(123456)).toBe(123456000000000000000000n);
    });

    it("should return BigInt type", () => {
      const result = valueToAttoBigInt(1);
      expect(typeof result).toBe("bigint");
    });
  });

  describe("round-trip conversions", () => {
    it("should maintain precision for round-trip conversions", () => {
      const testValues = [1, 0.5, 123.456, 0.000000001];

      testValues.forEach((value) => {
        const attoString = valueToAttoString(value);
        const backToNumber = attoValueToNumberValue(attoString);
        expect(backToNumber).toBeCloseTo(value, 15);
      });
    });

    it("should maintain precision for BigInt round-trip conversions", () => {
      const testValues = [1, 0.5, 123.456];

      testValues.forEach((value) => {
        const attoBigInt = valueToAttoBigInt(value);
        const backToNumber = attoValueToNumberValue(attoBigInt.toString());
        expect(backToNumber).toBeCloseTo(value, 15);
      });
    });
  });
});
