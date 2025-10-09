import { describe, expect, it } from "vitest";

import { Network } from "../src/rewards-allocator.js";
import RewardsClaimer from "../src/rewards-claimer.js";

describe("Claimer Error Path", () => {
  it("should throw error on network failure", async () => {
    const claimer = new RewardsClaimer(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:9999", // Invalid RPC to trigger failure
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 100, retryCount: 0, pollingInterval: 100 },
    );

    await expect(
      claimer.claim(
        "0x0000000000000000000000000000000000000000000000000000000000000000", // 32-byte merkle root
        1n,
        [],
      ),
    ).rejects.toThrow(/(fetch|ECONNREFUSED|timeout)/);
  });

  // Note: The transaction failure path (in `claim`) requires a transaction to be
  // submitted successfully but then fail with status !== "success". This is complex
  // to test as it requires contract-level failures, so we'll leave these lines
  // uncovered for now as they are defensive error handling.
});
