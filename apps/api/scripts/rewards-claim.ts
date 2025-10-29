import * as dotenv from "dotenv";
import { blue, cyan, green, magenta, red, yellow } from "kleur/colors";
import * as path from "path";
import { PropertyOptions, parse } from "ts-command-line-args";

import { Network, RewardsClaimer } from "@recallnet/staking-contracts";

import { config } from "@/config/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Interface for command line arguments
 */
interface IClaimRewardsArgs {
  privateKey: string;
  merkleRoot: string;
  proof: string;
  amount: string;
  network?: Network;
  help?: boolean;
}

/**
 * Claims rewards using a merkle proof
 * This script instantiates the RewardsClaimer and calls the claim method
 * with the provided merkle root, proof, and amount
 */
async function claimRewards() {
  // Parse command line arguments
  const args = parse<IClaimRewardsArgs>(
    {
      privateKey: {
        type: String,
        alias: "k",
        description:
          "The private key of the account claiming rewards (0x... format)",
      },
      merkleRoot: {
        type: String,
        alias: "r",
        description: "The merkle root hash for the reward allocation",
      },
      proof: {
        type: String,
        alias: "p",
        description:
          'JSON array of proof hashes (e.g., \'["0x1234...","0x5678..."]\')',
      },
      amount: {
        type: String,
        alias: "a",
        description: "The amount of tokens to claim (in wei)",
      },
      network: {
        type: String,
        alias: "n",
        optional: true,
        defaultValue: Network.BaseSepolia,
        description:
          "The network to use (baseSepolia, base, hardhat) - defaults to baseSepolia",
      } as PropertyOptions<Network | undefined>,
      help: {
        type: Boolean,
        alias: "h",
        optional: true,
        description: "Show this help message",
      },
    },
    {
      helpArg: "help",
      headerContentSections: [
        {
          header: "Rewards Claim Script",
          content:
            "Claims rewards using a merkle proof from the rewards contract.",
        },
      ],
      footerContentSections: [
        {
          header: "Environment Variables",
          content: [
            "REWARDS_CONTRACT_ADDRESS: The address of the rewards contract",
            "RPC_PROVIDER: The RPC provider URL for the blockchain",
          ].join("\n"),
        },
        {
          header: "Example",
          content:
            'pnpm rewards:claim --privateKey 0x1234... --merkleRoot 0xabcd... --proof \'["0x1234...","0x5678..."]\' --amount 1000000000000000000 --network baseSepolia',
        },
        {
          header: "Alternative Short Flags",
          content:
            'pnpm rewards:claim -k 0x1234... -r 0xabcd... -p \'["0x1234...","0x5678..."]\' -a 1000000000000000000 -n baseSepolia',
        },
      ],
    },
  );

  // Get contract address and RPC provider from environment variables
  const contractAddress = config.rewards.contractAddress;
  const rpcProviderUrl = config.rewards.rpcProvider;

  // Validate environment variables
  if (!contractAddress || !rpcProviderUrl) {
    console.error(`${red("Error: Missing required environment variables.")}`);
    console.log(`${yellow("Please set the following environment variables:")}`);
    if (!contractAddress) {
      console.log(
        `  ${blue("REWARDS_CONTRACT_ADDRESS:")} The address of the rewards contract`,
      );
    }
    if (!rpcProviderUrl) {
      console.log(
        `  ${blue("RPC_PROVIDER:")} The RPC provider URL for the blockchain`,
      );
    }
    process.exit(1);
  }

  // Parse and validate the proof
  const proof = JSON.parse(args.proof);
  if (!Array.isArray(proof)) {
    throw new Error("Proof must be an array");
  }

  // Validate private key format
  if (!args.privateKey.startsWith("0x") || args.privateKey.length !== 66) {
    console.error(
      `${red("Error: Invalid private key format. Must be a 64-character hex string starting with 0x.")}`,
    );
    process.exit(1);
  }

  // Validate merkle root format
  if (!args.merkleRoot.startsWith("0x") || args.merkleRoot.length !== 66) {
    console.error(
      `${red("Error: Invalid merkle root format. Must be a 64-character hex string starting with 0x.")}`,
    );
    process.exit(1);
  }

  // Validate contract address format
  if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
    console.error(
      `${red("Error: Invalid contract address format in REWARDS_CONTRACT_ADDRESS. Must be a 40-character hex string starting with 0x.")}`,
    );
    process.exit(1);
  }

  // Validate amount is a valid number
  const claimAmount = BigInt(args.amount);
  if (claimAmount <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  // Validate network
  const validNetworks = Object.values(Network);
  const selectedNetwork = args.network || Network.BaseSepolia;
  if (args.network && !validNetworks.includes(args.network)) {
    console.error(
      `${red("Error: Invalid network. Must be one of:")} ${validNetworks.join(", ")}`,
    );
    process.exit(1);
  }

  try {
    console.log(
      cyan(
        `╔════════════════════════════════════════════════════════════════╗`,
      ),
    );
    console.log(
      cyan(`║                     CLAIMING REWARDS                          ║`),
    );
    console.log(
      cyan(
        `╚════════════════════════════════════════════════════════════════╝`,
      ),
    );

    console.log(`\n${blue("Claiming rewards with the following parameters:")}`);
    console.log(
      `${blue("Private Key:")} ${yellow(args.privateKey.slice(0, 10) + "..." + args.privateKey.slice(-4))}`,
    );
    console.log(`${blue("Merkle Root:")} ${yellow(args.merkleRoot)}`);
    console.log(`${blue("Proof Length:")} ${yellow(proof.length + " hashes")}`);
    console.log(
      `${blue("Amount:")} ${yellow(claimAmount.toString() + " wei")}`,
    );
    console.log(
      `${blue("Contract Address:")} ${yellow(contractAddress)} (from REWARDS_CONTRACT_ADDRESS)`,
    );
    console.log(
      `${blue("RPC Provider:")} ${yellow(rpcProviderUrl)} (from RPC_PROVIDER)`,
    );
    console.log(`${blue("Network:")} ${yellow(selectedNetwork)}`);

    // Instantiate the RewardsClaimer
    const rewardsClaimer = new RewardsClaimer(
      args.privateKey as `0x${string}`,
      rpcProviderUrl,
      contractAddress as `0x${string}`,
      selectedNetwork,
    );

    console.log(`\n${magenta("Submitting claim transaction...")}`);

    // Call the claim method with all required parameters
    const result = await rewardsClaimer.claim(
      args.merkleRoot,
      claimAmount,
      proof,
    );

    console.log(`\n${green("Successfully claimed rewards!")}`);
    console.log(
      `${green("Transaction Hash:")} ${yellow(result.transactionHash)}`,
    );
    console.log(
      `${green("Block Number:")} ${yellow(result.blockNumber.toString())}`,
    );
    console.log(`${green("Gas Used:")} ${yellow(result.gasUsed.toString())}`);
  } catch (error) {
    console.error(
      `\n${red("Error claiming rewards:")}`,
      error instanceof Error ? error.message : error,
    );

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        console.log(
          `\n${yellow("Tip: Make sure the account has enough ETH to pay for gas fees.")}`,
        );
      } else if (error.message.includes("invalid merkle proof")) {
        console.log(
          `\n${yellow("Tip: Verify that the merkle root, proof, and amount are correct for this allocation.")}`,
        );
      } else if (error.message.includes("already claimed")) {
        console.log(
          `\n${yellow("Tip: This reward has already been claimed for this allocation.")}`,
        );
      } else if (error.message.includes("claim period not yet active")) {
        console.log(
          `\n${yellow("Tip: The claim period for this allocation has not started yet.")}`,
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
