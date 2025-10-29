import { MerkleTree } from "merkletreejs";
import { encodePacked, keccak256, parseEther } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import {
  ExternallyOwnedAccountAllocator,
  Network,
  NoopRewardsAllocator,
} from "../src/index.js";
import RewardsClaimer from "../src/rewards-claimer.js";
import { RewardAllocationTestHelper } from "./test-helper.js";

describe("Allocator Error Path", () => {
  it("should throw error on network failure", async () => {
    const allocator = new ExternallyOwnedAccountAllocator(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:8545",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 1000, retryCount: 1, pollingInterval: 100 },
    );

    // @ts-expect-error - accessing private property for test mocking
    const walletClient = allocator.walletClient as WalletClient;

    // Mock writeContract to throw a network error
    vi.spyOn(walletClient, "writeContract").mockRejectedValue(
      new Error("fetch failed: ECONNREFUSED"),
    );

    await expect(
      allocator.allocate(
        "0x0000000000000000000000000000000000000000000000000000000000000000", // 32-byte merkle root
        1n,
        1,
      ),
    ).rejects.toThrow(/(fetch|ECONNREFUSED)/);
  });

  it("should throw error when transaction receipt fails", async () => {
    const allocator = new ExternallyOwnedAccountAllocator(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:8545",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 1000, retryCount: 1, pollingInterval: 100 },
    );

    // Mock the internal clients to simulate a failed transaction
    const mockHash = "0x123";

    // Access private properties for testing
    // @ts-expect-error - accessing private property for test mocking
    const walletClient = allocator.walletClient as WalletClient;
    // @ts-expect-error - accessing private property for test mocking
    const publicClient = allocator.publicClient as PublicClient;

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
      allocator.allocate(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        1n,
        1,
      ),
    ).rejects.toThrow(/Transaction failed/);
  });
});

describe("Allocate Rewards", async () => {
  const network = await RewardAllocationTestHelper.initializeNetwork();

  // Extract the properties from the network object
  const {
    rewardAllocatorPrivateKey,
    rewardsContractAddress,
    mockTokenAddress,
  } = network;

  const rewardsAllocator = new ExternallyOwnedAccountAllocator(
    rewardAllocatorPrivateKey,
    network.getJsonRpcUrl(),
    rewardsContractAddress,
    mockTokenAddress,
    Network.Hardhat,
  );

  it("should create merkle tree with rewards for 3 accounts, allocate root, and verify proofs", async () => {
    try {
      // Use accounts that already have ETH in the test network
      // These are typically the first few accounts in hardhat
      const testAccounts = [
        privateKeyToAccount(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        ), // Account 0
        privateKeyToAccount(
          "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        ), // Account 1
        privateKeyToAccount(
          "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        ), // Account 2
      ];

      // Define rewards for each account
      const testRewards = [
        {
          address: testAccounts[0]!.address,
          amount: parseEther("100"), // 100 tokens
          privateKey:
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        },
        {
          address: testAccounts[1]!.address,
          amount: parseEther("250"), // 250 tokens
          privateKey:
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        },
        {
          address: testAccounts[2]!.address,
          amount: parseEther("500"), // 500 tokens
          privateKey:
            "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        },
      ];

      const leaves = testRewards.map((reward) =>
        createLeafNode(reward.address, reward.amount),
      );

      const merkleTree = new MerkleTree(leaves, keccak256, {
        sortPairs: true,
        hashLeaves: false,
        sortLeaves: true,
      });

      const merkleRoot = merkleTree.getHexRoot();

      // Calculate total amount for allocation
      const totalAmount = testRewards.reduce(
        (sum, reward) => sum + reward.amount,
        0n,
      );

      // Allocate the merkle root to the contract
      const startTimestamp = Math.floor(Date.now() / 1000);
      const allocationResult = await rewardsAllocator.allocate(
        merkleRoot,
        totalAmount,
        startTimestamp,
      );

      // Verify allocation was successful
      expect(allocationResult.transactionHash).toBeTruthy();

      // Wait a bit for the allocation to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Make claim calls for each account and check balances
      for (let i = 0; i < testRewards.length; i++) {
        const reward = testRewards[i]!; // Use non-null assertion since we know the array has elements
        const leaf = leaves[i]!; // Use non-null assertion since we know the array has elements
        const proof = merkleTree.getHexProof(leaf);

        // Create a RewardsClaimer for this account
        const rewardsClaimer = new RewardsClaimer(
          reward.privateKey as `0x${string}`,
          network.getJsonRpcUrl(),
          rewardsContractAddress,
          Network.Hardhat,
        );

        // Get initial balance before claiming
        const initialBalance = await rewardsClaimer.getBalance(
          mockTokenAddress,
          reward.address,
        );

        await rewardsClaimer.claim(merkleRoot, reward.amount, proof);

        // Get balance after claiming
        const finalBalance = await rewardsClaimer.getBalance(
          mockTokenAddress,
          reward.address,
        );
        // Verify the balance increased by the claimed amount
        const balanceIncrease = finalBalance - initialBalance;
        expect(balanceIncrease).toBe(reward.amount);
      }
    } finally {
      await network.close();
    }
  }, 30_000);
});

describe("NoopRewardsAllocator", () => {
  it("returns a fixed zero transaction hash", async () => {
    const allocator = new NoopRewardsAllocator();
    const result = await allocator.allocate(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      0n,
      0,
    );

    expect(result.transactionHash).toBe(
      "0x0000000000000000000000000000000000000000",
    );
  });
});

/**
 * Creates a Merkle leaf node by hashing reward data
 * @param address The recipient's Ethereum address
 * @param amount The reward amount as a bigint
 * @returns Buffer containing the keccak256 hash of the encoded parameters
 */
function createLeafNode(address: `0x${string}`, amount: bigint): Buffer {
  const hash = keccak256(
    // Use encodePacked to match the contract's leaf creation format
    // Contract: keccak256(abi.encodePacked("rl", msg.sender, claimAmount))
    encodePacked(["string", "address", "uint256"], ["rl", address, amount]),
  );

  // Convert hex string to Buffer
  return Buffer.from(hash.slice(2), "hex");
}
