import { MerkleTree } from "merkletreejs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodePacked, keccak256, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import RewardsAllocator, { Network } from "../src/rewards-allocator.js";
import RewardsClaimer from "../src/rewards-claimer.js";
import { RewardAllocationTestHelper } from "../src/test-helper.js";

describe("Allocator Error Path", () => {
  it("should throw error on transaction failure", async () => {
    // Mock a failed transaction to hit `allocate`
    const allocator = new RewardsAllocator(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "http://127.0.0.1:9999", // Invalid RPC to trigger failure
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      Network.Hardhat,
      { timeout: 100, retryCount: 0, pollingInterval: 100 },
    );

    await assert.rejects(
      () =>
        allocator.allocate(
          "0x0000000000000000000000000000000000000000000000000000000000000000", // 32-byte merkle root
          1n,
          1,
        ),
      (error: Error) =>
        error.message.includes("fetch") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout"),
    );
  });
});

describe("Allocate Rewards", async function () {
  const network = await RewardAllocationTestHelper.initializeNetwork();

  // Extract the properties from the network object
  const {
    rewardAllocatorPrivateKey,
    rewardsContractAddress,
    mockTokenAddress,
  } = network;

  const rewardsAllocator = new RewardsAllocator(
    rewardAllocatorPrivateKey,
    network.getJsonRpcUrl(),
    rewardsContractAddress,
    mockTokenAddress,
    Network.Hardhat,
  );

  it("should create merkle tree with rewards for 3 accounts, allocate root, and verify proofs", async function () {
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
      assert(
        allocationResult.transactionHash,
        "Transaction hash should be returned",
      );
      assert(
        allocationResult.blockNumber > 0n,
        "Block number should be greater than 0",
      );
      assert(
        allocationResult.gasUsed > 0n,
        "Gas used should be greater than 0",
      );

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
        assert(
          balanceIncrease === reward.amount,
          `Account ${i + 1} balance should increase by ${reward.amount.toString()}, but increased by ${balanceIncrease.toString()}`,
        );
      }
    } finally {
      await network.close();
    }
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
