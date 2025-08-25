import * as fs from "fs";
import { MerkleTree } from "merkletreejs";
import { encodeAbiParameters, keccak256, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { createLogger } from "@/lib/logger.js";

// Initialize pino logger
const logger = createLogger("AllocateRewards");

// Interface for reward data
interface RewardData {
  address: string;
  amount: string; // Amount as string to handle large numbers
}

// Interface for the script configuration
interface AllocationConfig {
  privateKey: string;
  alchemyApiKey: string;
  contractAddress: string;
  tokenAddress: string;
  startTimestamp: number; // Unix timestamp when claiming can begin
  rewards: RewardData[];
}

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length < 1) {
    logger.error("Usage: tsx scripts/allocateRewards.ts <CONFIG_FILE_PATH>");
    logger.error("Example: tsx scripts/allocateRewards.ts config/rewards.json");
    logger.error("");
    logger.error("Config file should contain:");
    logger.error("{");
    logger.error('  "privateKey": "0x...",');
    logger.error('  "alchemyApiKey": "your_alchemy_key",');
    logger.error('  "contractAddress": "0x...",');
    logger.error('  "tokenAddress": "0x...",');
    logger.error('  "startTimestamp": 1234567890,');
    logger.error('  "rewards": [');
    logger.error('    {"address": "0x...", "amount": "1000000000000000000"}');
    logger.error("  ]");
    logger.error("}");
    process.exit(1);
  }

  const configPath = args[0];

  try {
    // Read and parse the configuration file
    const configFile = fs.readFileSync(configPath as string, "utf8");
    const config: AllocationConfig = JSON.parse(configFile);

    logger.info("🚀 Starting reward allocation process...");
    logger.info(
      { totalRewards: config.rewards.length },
      "📊 Total rewards to allocate",
    );

    // Calculate total allocation amount
    const totalAmount = config.rewards.reduce((sum, reward) => {
      return sum + parseEther(reward.amount);
    }, 0n);

    logger.info(
      { totalAmount: totalAmount.toString() },
      "💰 Total allocation amount",
    );

    // Create account from private key
    const account = privateKeyToAccount(config.privateKey as `0x${string}`);
    logger.info({ address: account.address }, "👤 Using account");

    // Initialize RewardsAllocator
    const rewardsAllocator = new RewardsAllocator(
      config.privateKey as `0x${string}`,
      `https://base-sepolia.g.alchemy.com/v2/${config.alchemyApiKey}`,
      config.contractAddress as `0x${string}`,
    );

    // Build the merkle tree
    logger.info("🌳 Building merkle tree...");
    const tree = buildMerkleTree(config.rewards);
    logger.info({ root: tree.getHexRoot() }, "✅ Merkle tree built with root");

    // Allocate rewards to the contract using RewardsAllocator
    logger.info("📝 Allocating rewards to contract...");
    // Use RewardsAllocator to allocate rewards
    const result = await rewardsAllocator.allocate(
      tree.getHexRoot(),
      config.tokenAddress as `0x${string}`,
      totalAmount,
      Number(config.startTimestamp),
    );

    const proof = tree.getHexProof(
      createLeafNode(account.address as `0x${string}`, totalAmount),
    );
    logger.info({ proof }, "✅ Proof generated");

    logger.info(
      { transactionHash: result.transactionHash },
      "✅ Transaction sent!",
    );
    logger.info("⏳ Waiting for transaction confirmation...");

    logger.info("🎉 Successfully allocated rewards!");
    logger.info({ gasUsed: result.gasUsed }, "📊 Gas used");
    logger.info(
      {
        transactionUrl: `https://sepolia.basescan.org/tx/${result.transactionHash}`,
      },
      "🔗 Transaction URL",
    );

    logger.info("🎉 Reward allocation completed successfully!");
  } catch (error) {
    logger.error({ error }, "❌ Error occurred during reward allocation");
    process.exit(1);
  }
}

function buildMerkleTree(rewards: RewardData[]): MerkleTree {
  const leaves = [
    createFauxLeafNode("1"),
    ...rewards.map((reward) =>
      createLeafNode(
        reward.address as `0x${string}`,
        parseEther(reward.amount),
      ),
    ),
  ];

  const merkleTree = new MerkleTree(leaves, keccak256, {
    sortPairs: true,
    hashLeaves: false,
    sortLeaves: true,
  });

  return merkleTree;
}

export function createLeafNode(address: `0x${string}`, amount: bigint): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      ["rl", address, amount],
    ),
  );
}

function createFauxLeafNode(epochId: string): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      [
        epochId,
        "0x0000000000000000000000000000000000000000" as `0x${string}`,
        BigInt("0"),
      ],
    ),
  );
}

main().catch((error) => {
  logger.error({ error }, "❌ Unhandled error occurred");
  process.exit(1);
});
