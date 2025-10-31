import type { PublicClient, WalletClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { Network } from "../src/network.js";
import RewardsClaimer from "../src/rewards-claimer.js";

describe("Claimer Error Path", () => {
  it("should throw error on network failure", async () => {
    const claimer = new RewardsClaimer(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:8545",
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 1000, retryCount: 1, pollingInterval: 100 },
    );

    // @ts-expect-error - accessing private property for test mocking
    const walletClient = claimer.walletClient as WalletClient;

    // Mock writeContract to throw a network error
    vi.spyOn(walletClient, "writeContract").mockRejectedValue(
      new Error("fetch failed: ECONNREFUSED"),
    );

    await expect(
      claimer.claim(
        "0x0000000000000000000000000000000000000000000000000000000000000000", // 32-byte merkle root
        1n,
        [],
      ),
    ).rejects.toThrow(/(fetch|ECONNREFUSED)/);
  });

  it("should throw error when transaction receipt fails", async () => {
    const claimer = new RewardsClaimer(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:8545",
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 1000, retryCount: 1, pollingInterval: 100 },
    );

    // Mock the internal clients to simulate a failed transaction
    const mockHash = "0x123";

    // @ts-expect-error - accessing private property for test mocking
    const walletClient = claimer.walletClient as WalletClient;
    // @ts-expect-error - accessing private property for test mocking
    const publicClient = claimer.publicClient as PublicClient;

    // Mock writeContract to succeed but return a hash
    vi.spyOn(walletClient, "writeContract").mockResolvedValue(mockHash);

    // Mock waitForTransactionReceipt to return a failed receipt
    vi.spyOn(publicClient, "waitForTransactionReceipt").mockResolvedValue({
      status: "reverted",
      transactionHash: mockHash,
    } as unknown as Awaited<
      ReturnType<PublicClient["waitForTransactionReceipt"]>
    >);

    await expect(
      claimer.claim(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        1n,
        [],
      ),
    ).rejects.toThrow(/Claim transaction failed/);
  });
});
