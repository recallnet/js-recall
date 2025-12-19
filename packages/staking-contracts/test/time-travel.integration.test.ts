// ABOUTME: Integration tests for TimeTravel utility against a local blockchain.
// ABOUTME: Tests time manipulation, block mining, and snapshot/revert functionality.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TimeTravel, createTimeTravel } from "../src/time-travel.js";

describe("TimeTravel", () => {
  let timeTravel: TimeTravel;
  let initialSnapshot: `0x${string}`;

  beforeAll(async () => {
    timeTravel = createTimeTravel();
    // Save initial state to restore between tests
    initialSnapshot = await timeTravel.snapshot();
  });

  beforeEach(async () => {
    // Revert to initial state before each test
    await timeTravel.revert(initialSnapshot);
    // Take a new snapshot since revert consumes the old one
    initialSnapshot = await timeTravel.snapshot();
  });

  describe("getCurrentBlock", () => {
    it("should return current block info", async () => {
      const result = await timeTravel.getCurrentBlock();

      expect(result.timestamp).toBeTypeOf("number");
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.blockNumber).toBeTypeOf("bigint");
    });
  });

  describe("mine", () => {
    it("should mine a single block by default", async () => {
      const before = await timeTravel.getCurrentBlock();
      const result = await timeTravel.mine();

      expect(result.blockNumber).toBe(before.blockNumber + 1n);
    });

    it("should mine multiple blocks", async () => {
      const before = await timeTravel.getCurrentBlock();
      const result = await timeTravel.mine(5);

      // At least 5 blocks should have been mined
      expect(result.blockNumber).toBeGreaterThanOrEqual(
        before.blockNumber + 5n,
      );
    });
  });

  describe("increaseTime", () => {
    it("should advance time by specified seconds", async () => {
      const before = await timeTravel.getCurrentBlock();
      const secondsToAdvance = 3600; // 1 hour

      const result = await timeTravel.increaseTime(secondsToAdvance);

      expect(result.timestamp).toBeGreaterThanOrEqual(
        before.timestamp + secondsToAdvance,
      );
      expect(result.blockNumber).toBe(before.blockNumber + 1n);
    });

    it("should handle large time jumps", async () => {
      const before = await timeTravel.getCurrentBlock();
      const oneWeek = 7 * 24 * 60 * 60;

      const result = await timeTravel.increaseTime(oneWeek);

      expect(result.timestamp).toBeGreaterThanOrEqual(
        before.timestamp + oneWeek,
      );
    });
  });

  describe("setNextBlockTimestamp", () => {
    it("should set exact timestamp for next block", async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // Tomorrow

      const result = await timeTravel.setNextBlockTimestamp(futureTimestamp);

      expect(result.timestamp).toBe(futureTimestamp);
    });
  });

  describe("advanceBy", () => {
    it("should advance by days", async () => {
      const before = await timeTravel.getCurrentBlock();
      const result = await timeTravel.advanceBy({ days: 1 });

      expect(result.timestamp).toBeGreaterThanOrEqual(before.timestamp + 86400);
    });

    it("should advance by hours", async () => {
      const before = await timeTravel.getCurrentBlock();
      const result = await timeTravel.advanceBy({ hours: 2 });

      expect(result.timestamp).toBeGreaterThanOrEqual(before.timestamp + 7200);
    });

    it("should advance by combined duration", async () => {
      const before = await timeTravel.getCurrentBlock();
      const result = await timeTravel.advanceBy({
        days: 1,
        hours: 2,
        minutes: 30,
        seconds: 45,
      });

      const expectedSeconds = 86400 + 7200 + 1800 + 45;
      expect(result.timestamp).toBeGreaterThanOrEqual(
        before.timestamp + expectedSeconds,
      );
    });
  });

  describe("advanceToDate", () => {
    it("should advance to specific date", async () => {
      const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
      const result = await timeTravel.advanceToDate(targetDate);

      expect(result.timestamp).toBe(Math.floor(targetDate.getTime() / 1000));
    });
  });

  describe("snapshot and revert", () => {
    it("should restore state after revert", async () => {
      // Get current block state first
      const beforeSnapshot = await timeTravel.getCurrentBlock();

      // Take snapshot at current state
      const snapshotId = await timeTravel.snapshot();

      // Advance time significantly
      await timeTravel.advanceBy({ days: 30 });
      const after = await timeTravel.getCurrentBlock();
      expect(after.timestamp).toBeGreaterThan(
        beforeSnapshot.timestamp + 86400 * 29,
      );
      expect(after.blockNumber).toBeGreaterThan(beforeSnapshot.blockNumber);

      // Revert to snapshot
      await timeTravel.revert(snapshotId);
      const reverted = await timeTravel.getCurrentBlock();

      // Block number should be back to snapshot state
      expect(reverted.blockNumber).toBe(beforeSnapshot.blockNumber);
    });
  });
});
