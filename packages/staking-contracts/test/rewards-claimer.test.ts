import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Network } from "../src/rewards-allocator.js";
import RewardsClaimer from "../src/rewards-claimer.js";

describe("Claimer Error Path", () => {
  it("should throw error on network failure", async () => {
    // Test network-level failure (current working test)
    const claimer = new RewardsClaimer(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://invalid-url", // Invalid RPC to trigger failure
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 100, retryCount: 0 },
    );

    await assert.rejects(
      () =>
        claimer.claim(
          "0x0000000000000000000000000000000000000000000000000000000000000000", // 32-byte merkle root
          1n,
          [],
        ),
      (error: Error) =>
        error.message.includes("fetch") ||
        error.message.includes("ECONNREFUSED"),
    );
  });

  // Note: The transaction failure path (lines 94-95) requires a transaction to be
  // submitted successfully but then fail with status !== "success". This is complex
  // to test as it requires contract-level failures, so we'll leave these lines
  // uncovered for now as they are defensive error handling.
});
