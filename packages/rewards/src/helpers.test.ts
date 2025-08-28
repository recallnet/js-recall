import { Decimal } from "decimal.js-light";
import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  makeBoostDecayFn,
  splitIntoDailyIntervals,
  splitPrizePool,
} from "./helpers.js";
import { BoostTimeDecayRate } from "./index.js";
import type { BoostAllocationWindow } from "./types.js";

describe("splitIntoDailyIntervals", () => {
  it("should split a single day window into one interval", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T23:59:59Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([start, end]);
  });

  it("should split a two-day window into two intervals", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-02T23:59:59Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-01-02T00:00:00Z"),
      new Date("2024-01-02T23:59:59Z"),
    ]);
  });

  it("should split a three-day window into three intervals", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-03T23:59:59Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-01-02T00:00:00Z"),
      new Date("2024-01-03T00:00:00Z"),
    ]);
    expect(result[2]).toEqual([
      new Date("2024-01-03T00:00:00Z"),
      new Date("2024-01-03T23:59:59Z"),
    ]);
  });

  it("should handle partial day intervals correctly", () => {
    const start = new Date("2024-01-01T12:00:00Z");
    const end = new Date("2024-01-02T06:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([
      new Date("2024-01-01T12:00:00Z"),
      new Date("2024-01-02T06:00:00Z"),
    ]);
  });

  it("should handle window shorter than a day", () => {
    const start = new Date("2024-01-01T12:00:00Z");
    const end = new Date("2024-01-01T18:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([start, end]);
  });

  it("should handle window exactly one day long", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-02T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([start, end]);
  });

  it("should handle window slightly longer than one day", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-02T00:01:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-01-02T00:00:00Z"),
      new Date("2024-01-02T00:01:00Z"),
    ]);
  });

  it("should handle leap year dates correctly", () => {
    const start = new Date("2024-02-28T00:00:00Z");
    const end = new Date("2024-03-01T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      new Date("2024-02-28T00:00:00Z"),
      new Date("2024-02-29T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-02-29T00:00:00Z"),
      new Date("2024-03-01T00:00:00Z"),
    ]);
  });

  it("should handle non-leap year dates correctly", () => {
    const start = new Date("2023-02-28T00:00:00Z");
    const end = new Date("2023-03-01T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([start, end]);
  });

  it("should handle month boundaries correctly", () => {
    const start = new Date("2024-01-31T00:00:00Z");
    const end = new Date("2024-02-02T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      new Date("2024-01-31T00:00:00Z"),
      new Date("2024-02-01T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-02-01T00:00:00Z"),
      new Date("2024-02-02T00:00:00Z"),
    ]);
  });

  it("should handle year boundaries correctly", () => {
    const start = new Date("2023-12-31T00:00:00Z");
    const end = new Date("2024-01-02T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      new Date("2023-12-31T00:00:00Z"),
      new Date("2024-01-01T00:00:00Z"),
    ]);
    expect(result[1]).toEqual([
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ]);
  });

  it("should handle daylight saving time transitions", () => {
    // Test around DST transition (March 10, 2024 - clocks spring forward)
    const start = new Date("2024-03-10T00:00:00Z");
    const end = new Date("2024-03-11T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([start, end]);
  });

  it("should handle very long time periods", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-10T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(9);

    // Verify first interval
    expect(result[0]).toEqual([
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ]);

    // Verify last interval
    expect(result[8]).toEqual([
      new Date("2024-01-09T00:00:00Z"),
      new Date("2024-01-10T00:00:00Z"),
    ]);
  });

  it("should use the correct DAY_MS constant", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-02T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    // Verify that the interval uses exactly DAY_MS
    const expectedEnd = new Date(start.getTime() + DAY_MS);
    expect(result[0]).toEqual([start, expectedEnd]);
  });

  it("should handle edge case where start and end are the same", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(0);
  });

  it("should handle edge case where end is before start", () => {
    const start = new Date("2024-01-02T00:00:00Z");
    const end = new Date("2024-01-01T00:00:00Z");
    const window: BoostAllocationWindow = { start, end };

    const result = splitIntoDailyIntervals(window);

    expect(result).toHaveLength(0);
  });
});

describe("makeBoostDecayFn", () => {
  describe("with 3-day window and decay rate 0.5", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-04T00:00:00Z"),
    };
    const decayRate = 0.5;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return decay^1 = 0.5",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 0.5
      },
      {
        name: "timestamp in third day should return decay^2 = 0.25",
        timestamp: new Date("2024-01-03T12:00:00Z"),
        expected: new Decimal(decayRate).pow(2), // 0.25
      },
      {
        name: "timestamp at start of first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp just before end of first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T23:59:59Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp at start of second day should return decay^1 = 0.5",
        timestamp: new Date("2024-01-02T00:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 0.5
      },
      {
        name: "timestamp just before end of second day should return decay^1 = 0.5",
        timestamp: new Date("2024-01-02T23:59:59Z"),
        expected: new Decimal(decayRate).pow(1), // 0.5
      },
      {
        name: "timestamp at start of third day should return decay^2 = 0.25",
        timestamp: new Date("2024-01-03T00:00:00Z"),
        expected: new Decimal(decayRate).pow(2), // 0.25
      },
      {
        name: "timestamp just before end of third day should return decay^2 = 0.25",
        timestamp: new Date("2024-01-03T23:59:59Z"),
        expected: new Decimal(decayRate).pow(2), // 0.25
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with 1-day window and decay rate 0.5", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-02T00:00:00Z"),
    };
    const decayRate = 0.5;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in the day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp at start should return decay^0 = 1",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp just before end should return decay^0 = 1",
        timestamp: new Date("2024-01-01T23:59:59Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with 2-day window and decay rate 0.25", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-03T00:00:00Z"),
    };
    const decayRate = 0.25;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return decay^1 = 0.25",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 0.25
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with 5-day window and decay rate 0.8", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-06T00:00:00Z"),
    };
    const decayRate = 0.8;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return decay^1 = 0.8",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 0.8
      },
      {
        name: "timestamp in third day should return decay^2 = 0.64",
        timestamp: new Date("2024-01-03T12:00:00Z"),
        expected: new Decimal(decayRate).pow(2), // 0.64
      },
      {
        name: "timestamp in fourth day should return decay^3 = 0.512",
        timestamp: new Date("2024-01-04T12:00:00Z"),
        expected: new Decimal(decayRate).pow(3), // 0.512
      },
      {
        name: "timestamp in fifth day should return decay^4 = 0.4096",
        timestamp: new Date("2024-01-05T12:00:00Z"),
        expected: new Decimal(decayRate).pow(4), // 0.4096
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("edge cases and boundary conditions", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-03T00:00:00Z"),
    };
    const decayRate = 0.5;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp before window start should return 0",
        timestamp: new Date("2023-12-31T23:59:59Z"),
        expected: new Decimal(0),
      },
      {
        name: "timestamp at window end should return 0",
        timestamp: new Date("2024-01-03T00:00:00Z"),
        expected: new Decimal(0),
      },
      {
        name: "timestamp after window end should return 0",
        timestamp: new Date("2024-01-03T00:00:01Z"),
        expected: new Decimal(0),
      },
      {
        name: "timestamp far before window should return 0",
        timestamp: new Date("2023-01-01T00:00:00Z"),
        expected: new Decimal(0),
      },
      {
        name: "timestamp far after window should return 0",
        timestamp: new Date("2025-01-01T00:00:00Z"),
        expected: new Decimal(0),
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with partial day intervals", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T12:00:00Z"),
      end: new Date("2024-01-02T06:00:00Z"),
    };
    const decayRate = 0.5;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in partial first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T18:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp at start of partial first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp just before end of partial first day should return decay^0 = 1",
        timestamp: new Date("2024-01-02T05:59:59Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with decay rate of 1 (no decay)", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-04T00:00:00Z"),
    };
    const decayRate = 1;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return decay^1 = 1",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 1
      },
      {
        name: "timestamp in third day should return decay^2 = 1",
        timestamp: new Date("2024-01-03T12:00:00Z"),
        expected: new Decimal(decayRate).pow(2), // 1
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with decay rate of 0 (complete decay)", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-04T00:00:00Z"),
    };
    const decayRate = 0;
    const boostDecayFn = makeBoostDecayFn(window, decayRate);

    const testCases = [
      {
        name: "timestamp in first day should return decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(decayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return decay^1 = 0",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(decayRate).pow(1), // 0
      },
      {
        name: "timestamp in third day should return decay^2 = 0",
        timestamp: new Date("2024-01-03T12:00:00Z"),
        expected: new Decimal(decayRate).pow(2), // 0
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("with default BoostTimeDecayRate", () => {
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-04T00:00:00Z"),
    };
    const boostDecayFn = makeBoostDecayFn(window, BoostTimeDecayRate);

    const testCases = [
      {
        name: "timestamp in first day should return default decay^0 = 1",
        timestamp: new Date("2024-01-01T12:00:00Z"),
        expected: new Decimal(BoostTimeDecayRate).pow(0), // 1
      },
      {
        name: "timestamp in second day should return default decay^1 = 0.5",
        timestamp: new Date("2024-01-02T12:00:00Z"),
        expected: new Decimal(BoostTimeDecayRate).pow(1), // 0.5
      },
      {
        name: "timestamp in third day should return default decay^2 = 0.25",
        timestamp: new Date("2024-01-03T12:00:00Z"),
        expected: new Decimal(BoostTimeDecayRate).pow(2), // 0.25
      },
    ];

    testCases.forEach(({ name, timestamp, expected }) => {
      it(name, () => {
        const result = boostDecayFn(timestamp);
        expect(result.equals(expected)).toBe(true);
      });
    });
  });

  describe("function reuse with different windows", () => {
    it("should create independent functions for different windows", () => {
      const window1: BoostAllocationWindow = {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-03T00:00:00Z"),
      };
      const window2: BoostAllocationWindow = {
        start: new Date("2024-01-05T00:00:00Z"),
        end: new Date("2024-01-07T00:00:00Z"),
      };
      const decayRate = 0.5;

      const boostDecayFn1 = makeBoostDecayFn(window1, decayRate);
      const boostDecayFn2 = makeBoostDecayFn(window2, decayRate);

      // Same timestamp should give different results for different windows
      const timestamp = new Date("2024-01-02T12:00:00Z");

      expect(
        boostDecayFn1(timestamp).equals(new Decimal(decayRate).pow(1)),
      ).toBe(true); // 0.5 (second day of window1)
      expect(boostDecayFn2(timestamp).equals(new Decimal(0))).toBe(true); // Outside window2
    });

    it("should create independent functions for different decay rates", () => {
      const window: BoostAllocationWindow = {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-03T00:00:00Z"),
      };

      const boostDecayFn1 = makeBoostDecayFn(window, 0.5);
      const boostDecayFn2 = makeBoostDecayFn(window, 0.25);

      const timestamp = new Date("2024-01-02T12:00:00Z");

      expect(boostDecayFn1(timestamp).equals(new Decimal(0.5).pow(1))).toBe(
        true,
      ); // 0.5
      expect(boostDecayFn2(timestamp).equals(new Decimal(0.25).pow(1))).toBe(
        true,
      ); // 0.25
    });
  });
});

describe("splitPrizePool", () => {
  it("should split 1000 amount among 10 competitors with decay rate 0.5", () => {
    const amount = 1000n; // Using bigint for WEI
    const leaderBoard = [
      "competitor1",
      "competitor2",
      "competitor3",
      "competitor4",
      "competitor5",
      "competitor6",
      "competitor7",
      "competitor8",
      "competitor9",
      "competitor10",
    ];
    const r = 0.5;

    const result = splitPrizePool(amount, leaderBoard, r);

    // Verify all competitors are present
    expect(Object.keys(result)).toHaveLength(10);
    expect(result).toHaveProperty("competitor1");
    expect(result).toHaveProperty("competitor2");
    expect(result).toHaveProperty("competitor3");
    expect(result).toHaveProperty("competitor4");
    expect(result).toHaveProperty("competitor5");
    expect(result).toHaveProperty("competitor6");
    expect(result).toHaveProperty("competitor7");
    expect(result).toHaveProperty("competitor8");
    expect(result).toHaveProperty("competitor9");
    expect(result).toHaveProperty("competitor10");

    // Calculate exact expected values using Decimal for precision
    // Formula: weight = ((1 - r) * Math.pow(r, i - 1)) / (1 - Math.pow(r, k))
    const k = leaderBoard.length;
    const rDecimal = new Decimal(r);
    const amountDecimal = new Decimal(amount.toString());
    const denominator = new Decimal(1).minus(rDecimal.pow(k));

    const expectedValues: Decimal[] = [];
    for (let i = 1; i <= k; i++) {
      const weight = new Decimal(1)
        .minus(rDecimal)
        .times(rDecimal.pow(i - 1))
        .div(denominator);
      const value = weight.times(amountDecimal);
      expectedValues.push(value);
    }

    // Verify exact values
    expect(result.competitor1!.equals(expectedValues[0]!)).toBe(true);
    expect(result.competitor2!.equals(expectedValues[1]!)).toBe(true);
    expect(result.competitor3!.equals(expectedValues[2]!)).toBe(true);
    expect(result.competitor4!.equals(expectedValues[3]!)).toBe(true);
    expect(result.competitor5!.equals(expectedValues[4]!)).toBe(true);
    expect(result.competitor6!.equals(expectedValues[5]!)).toBe(true);
    expect(result.competitor7!.equals(expectedValues[6]!)).toBe(true);
    expect(result.competitor8!.equals(expectedValues[7]!)).toBe(true);
    expect(result.competitor9!.equals(expectedValues[8]!)).toBe(true);
    expect(result.competitor10!.equals(expectedValues[9]!)).toBe(true);

    // Verify the total amount equals the input amount exactly using Decimal
    const totalSplit = Object.values(result).reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0),
    );
    // Check if the difference is within a very small tolerance (1e-15)
    const difference = totalSplit.minus(amountDecimal).abs();
    expect(difference.lte(new Decimal("1e-15"))).toBe(true);

    // Verify the decay pattern: each subsequent competitor gets r times the previous amount
    const values = Object.values(result);
    expect(values[0]!.gt(values[1]!)).toBe(true); // First should be greater than second
    expect(values[1]!.gt(values[2]!)).toBe(true); // Second should be greater than third
    expect(values[2]!.gt(values[3]!)).toBe(true); // Third should be greater than fourth

    // Verify the decay ratio is approximately correct using Decimal
    // With r = 0.5, each value should be approximately half of the previous
    const ratio1 = values[1]!.div(values[0]!);
    const ratio2 = values[2]!.div(values[1]!);
    const ratio3 = values[3]!.div(values[2]!);
    expect(ratio1.minus(rDecimal).abs().lte(new Decimal("1e-15"))).toBe(true);
    expect(ratio2.minus(rDecimal).abs().lte(new Decimal("1e-15"))).toBe(true);
    expect(ratio3.minus(rDecimal).abs().lte(new Decimal("1e-15"))).toBe(true);

    // Verify all values are positive
    Object.values(result).forEach((value) => {
      expect(value.gt(0)).toBe(true);
    });
  });
});
