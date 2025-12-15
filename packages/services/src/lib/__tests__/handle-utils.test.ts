import { describe, expect, it } from "vitest";

import {
  generateRandomString,
  generateRandomUsername,
} from "../handle-utils.js";

describe("generateRandomString", () => {
  it("should generate a string of the specified length", () => {
    expect(generateRandomString(8)).toHaveLength(8);
    expect(generateRandomString(16)).toHaveLength(16);
    expect(generateRandomString(1)).toHaveLength(1);
  });

  it("should only contain lowercase alphanumeric characters", () => {
    const result = generateRandomString(100);
    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it("should generate different strings on each call", () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generateRandomString(8));
    }
    // With 36^8 possibilities, 100 calls should produce 100 unique strings
    expect(results.size).toBe(100);
  });
});

describe("generateRandomUsername", () => {
  it("should generate a username with user_ prefix", () => {
    const username = generateRandomUsername();
    expect(username).toMatch(/^user_[a-z0-9]{8}$/);
  });

  it("should generate usernames of consistent length", () => {
    const username = generateRandomUsername();
    expect(username).toHaveLength(13); // "user_" (5) + 8 random chars
  });

  it("should generate unique usernames", () => {
    const usernames = new Set<string>();
    for (let i = 0; i < 100; i++) {
      usernames.add(generateRandomUsername());
    }
    expect(usernames.size).toBe(100);
  });
});
