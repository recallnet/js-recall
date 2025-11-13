import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { blue, cyan, green, red, yellow } from "kleur/colors";
import { MerkleTree } from "merkletreejs";
import * as path from "path";
import { parse } from "ts-command-line-args";
import { randomUUID } from "crypto";
import { hexToBytes, keccak256 } from "viem";

import { competitions, users } from "@recallnet/db/schema/core/defs";
import { rewards } from "@recallnet/db/schema/rewards/defs";
import { createFauxLeafNode, createLeafNode } from "@recallnet/services";

import { db } from "@/database/db.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Interface for command line arguments
 */
interface IInsertRewardArgs {
  userId: string;
  address?: string;
  amount: string;
  help?: boolean;
}

/**
 * Create a new competition and insert a single reward into the database, then generate merkle proof
 */
async function insertReward() {
  // Parse command line arguments
  const args = parse<IInsertRewardArgs>(
    {
      userId: {
        type: String,
        alias: "u",
        description: "The user ID (UUID format)",
      },
      address: {
        type: String,
        alias: "a",
        optional: true,
        description:
          "The wallet address (0x... format). If not provided, will be fetched from the user record.",
      },
      amount: {
        type: String,
        alias: "m",
        description:
          "The reward amount in wei (e.g., 100000000000000000 for 0.1 token)",
      },
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
          header: "Rewards Insert Script",
          content:
            "Creates a new competition and inserts a single reward record for a specific user.",
        },
      ],
      footerContentSections: [
        {
          header: "Example",
          content:
            "pnpm rewards:insert --userId 987fcdeb-51a2-43f7-8abc-123456789012 --amount 100000000000000000",
        },
        {
          header: "Example with explicit address",
          content:
            "pnpm rewards:insert --userId 987fcdeb-51a2-43f7-8abc-123456789012 --address 0x00A826b7a0C21C7f3C7156C4e1Aa197a111B8233 --amount 100000000000000000",
        },
      ],
    },
  );

  try {
    console.log(
      cyan(
        `╔════════════════════════════════════════════════════════════════╗`,
      ),
    );
    console.log(
      cyan(
        `║              CREATING COMPETITION AND REWARD                   ║`,
      ),
    );
    console.log(
      cyan(
        `╚════════════════════════════════════════════════════════════════╝`,
      ),
    );

    console.log(`\n${blue("User ID:")} ${yellow(args.userId)}`);
    console.log(`${blue("Amount (wei):")} ${yellow(args.amount)}`);

    // Create competition
    const competitionId = randomUUID();

    console.log(
      `\n${blue("Creating competition with ID:")} ${yellow(competitionId)}`,
    );

    await db.insert(competitions).values({
      id: competitionId,
      name: "Test Competition",
      description: "A test competition for rewards",
      status: "active",
      type: "trading",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    console.log(`${green("Competition created successfully")}`);

    // Fetch user to get wallet address if not provided
    console.log(`\n${blue("Fetching user record...")}`);
    const user = await db.query.users.findFirst({
      where: eq(users.id, args.userId),
    });

    if (!user) {
      throw new Error(`User not found with ID: ${args.userId}`);
    }

    console.log(`${green("User found:")} ${yellow(user.name || "N/A")}`);

    // Use provided address or fetch from user record
    const walletAddress = args.address || user.walletAddress;

    if (!walletAddress) {
      throw new Error(
        "No wallet address found. Please provide --address or ensure the user has a wallet address.",
      );
    }

    console.log(`${blue("Wallet Address:")} ${yellow(walletAddress)}`);

    // Validate address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error(
        "Invalid address format. Must be a valid Ethereum address (0x...)",
      );
    }

    // Parse amount to BigInt
    const amountBigInt = BigInt(args.amount);

    // Validate amount is positive
    if (amountBigInt <= 0n) {
      throw new Error("Amount must be greater than 0");
    }

    // Create leaf hash for the reward
    const leafHash = createLeafNode(
      walletAddress as `0x${string}`,
      amountBigInt,
    );

    console.log(`\n${blue("Inserting reward into database...")}`);

    // Insert the reward
    await db.insert(rewards).values({
      competitionId: competitionId,
      userId: args.userId,
      address: walletAddress as `0x${string}`,
      amount: amountBigInt,
      leafHash: hexToBytes(leafHash),
      claimed: false,
    });

    console.log(
      `${green("Successfully inserted reward for address:")} ${yellow(walletAddress)}`,
    );
    console.log(`${green("Amount:")} ${yellow(amountBigInt.toString())} wei`);
    console.log(`${green("Leaf Hash:")} ${yellow(`0x${leafHash}`)}`);

    // Fetch all rewards for this competition to generate merkle tree
    console.log(
      `\n${blue("Fetching all rewards for competition to generate Merkle tree...")}`,
    );

    const allRewards = await db.query.rewards.findMany({
      where: (rewards, { eq }) => eq(rewards.competitionId, competitionId),
    });

    if (allRewards.length === 0) {
      console.log(
        `${yellow("Warning: No rewards found for this competition. Cannot generate Merkle tree.")}`,
      );
      return;
    }

    console.log(
      `${green("Found")} ${yellow(allRewards.length.toString())} ${green("reward(s) for this competition")}`,
    );

    // Create leaf hashes for all rewards
    const leafHashes = allRewards.map((reward) =>
      createLeafNode(reward.address as `0x${string}`, reward.amount),
    );

    // Prepend faux leaf node
    const fauxLeaf = createFauxLeafNode(competitionId);
    const allLeaves = [fauxLeaf, ...leafHashes];

    // Build Merkle tree
    const merkleTree = new MerkleTree(allLeaves, keccak256, {
      sortPairs: true,
      hashLeaves: false,
      sortLeaves: true,
    });

    const merkleRoot = merkleTree.getHexRoot();

    console.log(`\n${green("Merkle Root:")} ${yellow(merkleRoot)}`);

    // Generate proof for the newly inserted reward
    const proof = merkleTree.getHexProof(leafHash);

    // Display summary
    console.log(
      `\n${cyan(`╔════════════════════════════════════════════════════════════════╗`)}`,
    );
    console.log(
      `${cyan(`║                    REWARD SUMMARY                              ║`)}`,
    );
    console.log(
      `${cyan(`╚════════════════════════════════════════════════════════════════╝`)}`,
    );

    console.log(`\n${green("Competition ID:")} ${yellow(competitionId)}`);
    console.log(`${green("User ID:")} ${yellow(args.userId)}`);
    console.log(`${green("User Name:")} ${yellow(user.name || "N/A")}`);
    console.log(`${green("Address:")} ${yellow(walletAddress)}`);
    console.log(`${green("Amount:")} ${yellow(amountBigInt.toString())} wei`);
    console.log(`${green("Leaf Hash:")} ${yellow(`0x${leafHash}`)}`);
    console.log(`${green("Merkle Root:")} ${yellow(merkleRoot)}`);
    console.log(`${green("Proof:")} ${yellow(`[${proof.join(", ")}]`)}`);

    console.log(`\n${green("Next steps:")}`);
    console.log(
      `${yellow("1.")} Run the allocation script: ${cyan(`pnpm rewards:allocate --competitionId ${competitionId} --tokenAddress <TOKEN_ADDRESS> --startTimestamp <TIMESTAMP>`)}`,
    );
    console.log(`${yellow("2.")} Use the proof above to claim the reward`);
  } catch (error) {
    console.error(
      `\n${red("Error inserting reward:")}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
insertReward();
