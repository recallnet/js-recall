import * as dotenv from "dotenv";
import * as path from "path";

import { Network } from "@recallnet/staking-contracts/rewards-allocator";
import RewardsClaimer from "@recallnet/staking-contracts/rewards-claimer";

import { config } from "@/config/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
};

/**
 * Claims rewards using a merkle proof
 * This script instantiates the RewardsClaimer and calls the claim method
 * with the provided merkle root, proof, and amount
 */
async function claimRewards() {
  // Get the required parameters from command line arguments
  const privateKey = process.argv[2];
  const merkleRoot = process.argv[3];
  const proofString = process.argv[4];
  const amount = process.argv[5];
  const network = process.argv[6] as Network;

  // Get contract address and RPC provider from environment variables
  const contractAddress = config.rewards.contractAddress;
  const rpcProviderUrl = config.rewards.rpcProvider;

  // Validate required parameters
  if (!privateKey || !merkleRoot || !proofString || !amount) {
    console.error(
      `${colors.red}Error: Missing required parameters.${colors.reset}`,
    );
    console.log(
      `${colors.cyan}Usage: pnpm rewards:claim <privateKey> <merkleRoot> <proof> <amount> [network]${colors.reset}`,
    );
    console.log(
      `${colors.cyan}Example: pnpm rewards:claim 0x1234... 0xabcd... '["0x1234...","0x5678..."]' 1000000000000000000 baseSepolia${colors.reset}`,
    );
    console.log(`${colors.yellow}Parameters:${colors.reset}`);
    console.log(
      `  ${colors.blue}privateKey${colors.reset}: The private key of the account claiming rewards (0x... format)`,
    );
    console.log(
      `  ${colors.blue}merkleRoot${colors.reset}: The merkle root hash for the reward allocation`,
    );
    console.log(
      `  ${colors.blue}proof${colors.reset}: JSON array of proof hashes (e.g., '["0x1234...","0x5678..."]')`,
    );
    console.log(
      `  ${colors.blue}amount${colors.reset}: The amount of tokens to claim (in wei)`,
    );
    console.log(
      `  ${colors.blue}network${colors.reset}: The network to use (baseSepolia, base, hardhat) - defaults to baseSepolia`,
    );
    console.log(`\n${colors.yellow}Environment Variables:${colors.reset}`);
    console.log(
      `  ${colors.blue}REWARDS_CONTRACT_ADDRESS${colors.reset}: The address of the rewards contract`,
    );
    console.log(
      `  ${colors.blue}RPC_PROVIDER${colors.reset}: The RPC provider URL for the blockchain`,
    );
    process.exit(1);
  }

  // Validate environment variables
  if (!contractAddress || !rpcProviderUrl) {
    console.error(
      `${colors.red}Error: Missing required environment variables.${colors.reset}`,
    );
    console.log(
      `${colors.yellow}Please set the following environment variables:${colors.reset}`,
    );
    if (!contractAddress) {
      console.log(
        `  ${colors.blue}REWARDS_CONTRACT_ADDRESS${colors.reset}: The address of the rewards contract`,
      );
    }
    if (!rpcProviderUrl) {
      console.log(
        `  ${colors.blue}RPC_PROVIDER${colors.reset}: The RPC provider URL for the blockchain`,
      );
    }
    process.exit(1);
  }

  // Parse and validate the proof
  const proof = JSON.parse(proofString);
  if (!Array.isArray(proof)) {
    throw new Error("Proof must be an array");
  }

  // Validate private key format
  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    console.error(
      `${colors.red}Error: Invalid private key format. Must be a 64-character hex string starting with 0x.${colors.reset}`,
    );
    process.exit(1);
  }

  // Validate merkle root format
  if (!merkleRoot.startsWith("0x") || merkleRoot.length !== 66) {
    console.error(
      `${colors.red}Error: Invalid merkle root format. Must be a 64-character hex string starting with 0x.${colors.reset}`,
    );
    process.exit(1);
  }

  // Validate contract address format
  if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
    console.error(
      `${colors.red}Error: Invalid contract address format in REWARDS_CONTRACT_ADDRESS. Must be a 40-character hex string starting with 0x.${colors.reset}`,
    );
    process.exit(1);
  }

  // Validate amount is a valid number
  const claimAmount = BigInt(amount);
  if (claimAmount <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  // Validate network
  const validNetworks = Object.values(Network);
  const selectedNetwork = network || Network.BaseSepolia;
  if (network && !validNetworks.includes(network)) {
    console.error(
      `${colors.red}Error: Invalid network. Must be one of: ${validNetworks.join(", ")}${colors.reset}`,
    );
    process.exit(1);
  }

  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                     CLAIMING REWARDS                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\n${colors.blue}Claiming rewards with the following parameters:${colors.reset}`,
    );
    console.log(
      `${colors.blue}Private Key: ${colors.yellow}${privateKey.slice(0, 10)}...${privateKey.slice(-4)}${colors.reset}`,
    );
    console.log(
      `${colors.blue}Merkle Root: ${colors.yellow}${merkleRoot}${colors.reset}`,
    );
    console.log(
      `${colors.blue}Proof Length: ${colors.yellow}${proof.length} hashes${colors.reset}`,
    );
    console.log(
      `${colors.blue}Amount: ${colors.yellow}${claimAmount.toString()} wei${colors.reset}`,
    );
    console.log(
      `${colors.blue}Contract Address: ${colors.yellow}${contractAddress}${colors.reset} (from REWARDS_CONTRACT_ADDRESS)`,
    );
    console.log(
      `${colors.blue}RPC Provider: ${colors.yellow}${rpcProviderUrl}${colors.reset} (from RPC_PROVIDER)`,
    );
    console.log(
      `${colors.blue}Network: ${colors.yellow}${selectedNetwork}${colors.reset}`,
    );

    // Instantiate the RewardsClaimer
    const rewardsClaimer = new RewardsClaimer(
      privateKey as `0x${string}`,
      rpcProviderUrl,
      contractAddress as `0x${string}`,
      selectedNetwork,
    );

    console.log(
      `\n${colors.magenta}Submitting claim transaction...${colors.reset}`,
    );

    // Call the claim method with all required parameters
    const result = await rewardsClaimer.claim(merkleRoot, claimAmount, proof);

    console.log(
      `\n${colors.green}Successfully claimed rewards!${colors.reset}`,
    );
    console.log(
      `${colors.green}Transaction Hash: ${colors.yellow}${result.transactionHash}${colors.reset}`,
    );
    console.log(
      `${colors.green}Block Number: ${colors.yellow}${result.blockNumber.toString()}${colors.reset}`,
    );
    console.log(
      `${colors.green}Gas Used: ${colors.yellow}${result.gasUsed.toString()}${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error claiming rewards:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        console.log(
          `\n${colors.yellow}Tip: Make sure the account has enough ETH to pay for gas fees.${colors.reset}`,
        );
      } else if (error.message.includes("invalid merkle proof")) {
        console.log(
          `\n${colors.yellow}Tip: Verify that the merkle root, proof, and amount are correct for this allocation.${colors.reset}`,
        );
      } else if (error.message.includes("already claimed")) {
        console.log(
          `\n${colors.yellow}Tip: This reward has already been claimed for this allocation.${colors.reset}`,
        );
      } else if (error.message.includes("claim period not yet active")) {
        console.log(
          `\n${colors.yellow}Tip: The claim period for this allocation has not started yet.${colors.reset}`,
        );
      }
    }

    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
claimRewards();
