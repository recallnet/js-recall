/**
 * Tests for the formatBytes utility function.
 * These tests verify that the function correctly formats byte values using binary (base-2) units
 * and handles various edge cases appropriately.
 */
import { describe, expect, it } from "vitest";

import { formatBytes } from "../format-bytes";

describe("formatBytes", () => {
  /**
   * Basic cases
   */
  it("formats 0 bytes correctly", () => {
    expect(formatBytes(0)).toEqual({
      val: 0,
      unit: "Bytes",
      formatted: "0 Bytes",
    });
  });

  it("formats 1 byte correctly", () => {
    expect(formatBytes(1)).toEqual({
      val: 1,
      unit: "Byte",
      formatted: "1 Byte",
    });
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toEqual({
      val: 500,
      unit: "Bytes",
      formatted: "500 Bytes",
    });
  });

  /**
   * Binary unit conversions
   */
  it("formats KiB correctly", () => {
    expect(formatBytes(1024)).toEqual({
      val: 1,
      unit: "KiB",
      formatted: "1 KiB",
    });
  });

  it("formats MiB correctly", () => {
    expect(formatBytes(1024 * 1024)).toEqual({
      val: 1,
      unit: "MiB",
      formatted: "1 MiB",
    });
  });

  it("formats GiB correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toEqual({
      val: 1,
      unit: "GiB",
      formatted: "1 GiB",
    });
  });

  it("formats TiB correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toEqual({
      val: 1,
      unit: "TiB",
      formatted: "1 TiB",
    });
  });

  /**
   * Special cases and precision handling
   */
  it("handles decimal values correctly", () => {
    expect(formatBytes(1536)).toEqual({
      val: 1.5,
      unit: "KiB",
      formatted: "1.5 KiB",
    });
  });

  it("rounds to 2 decimal places", () => {
    expect(formatBytes(1024 * 1.234567)).toEqual({
      val: 1.23,
      unit: "KiB",
      formatted: "1.23 KiB",
    });
  });

  it("handles edge case between units", () => {
    expect(formatBytes(1023)).toEqual({
      val: 1023,
      unit: "Bytes",
      formatted: "1023 Bytes",
    });
    expect(formatBytes(1025)).toEqual({
      val: 1,
      unit: "KiB",
      formatted: "1 KiB",
    });
  });
});
