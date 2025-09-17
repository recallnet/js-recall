import * as dotenv from "dotenv";
import { MerkleTree } from "merkletreejs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { hexToBytes, keccak256 } from "viem";

import { competitions } from "@recallnet/db-schema/core/defs";
import { rewards } from "@recallnet/db-schema/voting/defs";

import { db } from "@/database/db.js";
import {
  createFauxLeafNode,
  createLeafNode,
} from "@/services/rewards.service.js";

// Color functions for terminal output
const blue = (str: string) => str;
const cyan = (str: string) => str;
const green = (str: string) => str;
const magenta = (str: string) => str;
const red = (str: string) => str;
const yellow = (str: string) => str;

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Predefined test wallets for rewards testing
 */
const TEST_WALLETS = [
  {
    privateKey:
      "0xb75556f5ddcdeaaa9f811f17e0b60082e19ced1f5d2b12a9b63a50cb1fe24c8b",
    address: "0x00A826b7a0C21C7f3C7156C4e1Aa197a111B8233",
  },
  {
    privateKey:
      "0x686f7b7389a72765ff54ffa484775fc0a5a2977f8d273f869186f317d726e5d0",
    address: "0x1eC7b77A5E5B9Cf7aa1bdfc88367C2CCCe3176c7",
  },
  {
    privateKey:
      "0x6f9dbe6d65e6e7757301b0448d1e1590ee15bd9454e333f31662d45c772af75d",
    address: "0xacCf94CC4B331DEA07892993F034793397D3CE93",
  },
];

/**
 * Insert one competition and three rewards into the database
 */
async function insertCompetitionAndRewards() {
  try {
    console.log(
      cyan(
        `╔════════════════════════════════════════════════════════════════╗`,
      ),
    );
    console.log(
      cyan(
        `║              INSERTING COMPETITION AND REWARDS                 ║`,
      ),
    );
    console.log(
      cyan(
        `╚════════════════════════════════════════════════════════════════╝`,
      ),
    );

    // Insert competition
    const competitionId = uuidv4();

    console.log(
      `\n${blue("Inserting competition with ID:")} ${yellow(competitionId)}`,
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

    // Define reward data with predefined test wallets
    const rewardsData = [
      {
        address: TEST_WALLETS[0]!.address as `0x${string}`,
        amount: BigInt("100000000000000000"), // 0.1 token in WEI
        privateKey: TEST_WALLETS[0]!.privateKey,
      },
      {
        address: TEST_WALLETS[1]!.address as `0x${string}`,
        amount: BigInt("200000000000000000"), // 0.2 tokens in WEI
        privateKey: TEST_WALLETS[1]!.privateKey,
      },
      {
        address: TEST_WALLETS[2]!.address as `0x${string}`,
        amount: BigInt("300000000000000000"), // 0.3 tokens in WEI
        privateKey: TEST_WALLETS[2]!.privateKey,
      },
    ];

    console.log(
      `\n${blue("Inserting rewards for competition:")} ${yellow(competitionId)}`,
    );

    // Insert rewards
    for (const reward of rewardsData) {
      const leafHash = createLeafNode(reward.address, reward.amount);

      await db.insert(rewards).values({
        id: uuidv4(),
        competitionId: competitionId,
        address: reward.address,
        amount: reward.amount,
        leafHash: hexToBytes(leafHash),
        claimed: false,
      });

      console.log(
        `${green("Inserted reward for address:")} ${yellow(reward.address)} ${green("with amount:")} ${yellow(reward.amount.toString())}`,
      );
      console.log(`${magenta("Private key:")} ${yellow(reward.privateKey)}`);
    }

    console.log(`\n${green("Successfully inserted competition and rewards.")}`);
    console.log(`${green("Competition ID:")} ${yellow(competitionId)}`);
    console.log(
      `${green("You can now run:")} ${yellow(`pnpm rewards:allocate --competitionId ${competitionId} --tokenAddress <TOKEN_ADDRESS> --startTimestamp <TIMESTAMP>`)}`,
    );

    // Generate Merkle tree and proofs
    console.log(`\n${blue("Generating Merkle tree and proofs...")}`);

    // Create leaf hashes for the merkle tree
    const leafHashes = rewardsData.map((reward) =>
      createLeafNode(reward.address, reward.amount),
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

    console.log(`${green("Merkle Root:")} ${yellow(merkleRoot)}`);

    // Generate proofs for each user (excluding the faux leaf)
    const userProofs = rewardsData.map((reward, index) => {
      const leafHash = leafHashes[index]!;
      const proof = merkleTree.getHexProof(leafHash);
      return {
        address: reward.address,
        amount: reward.amount,
        privateKey: reward.privateKey,
        proof: proof,
      };
    });

    // Display merkle root and all data in a summary
    console.log(
      `\n${cyan(`╔════════════════════════════════════════════════════════════════╗`)}`,
    );
    console.log(
      `${cyan(`║                    MERKLE TREE & PROOFS SUMMARY               ║`)}`,
    );
    console.log(
      `${cyan(`╚════════════════════════════════════════════════════════════════╝`)}`,
    );

    console.log(`\n${green("Merkle Root:")} ${yellow(merkleRoot)}`);

    userProofs.forEach((userProof, index) => {
      console.log(`\n${blue(`Reward ${index + 1}:`)}`);
      console.log(`${yellow("Address:")} ${userProof.address}`);
      console.log(`${yellow("Private Key:")} ${userProof.privateKey}`);
      console.log(`${yellow("Amount:")} ${userProof.amount.toString()}`);
      console.log(`${yellow("Leaf Hash:")} 0x${leafHashes[index]!}`);
      console.log(`${yellow("Proof:")} [${userProof.proof.join(", ")}]`);
    });

    // Print ready-to-use claim commands for each user
    console.log(
      `\n${cyan(`╔════════════════════════════════════════════════════════════════╗`)}`,
    );
    console.log(
      `${cyan(`║                    READY-TO-USE CLAIM COMMANDS                 ║`)}`,
    );
    console.log(
      `${cyan(`╚════════════════════════════════════════════════════════════════╝`)}`,
    );

    userProofs.forEach((userProof, index) => {
      console.log(`\n${green(`User ${index + 1} Claim Command:`)}`);
      console.log(
        `${yellow(`pnpm rewards:claim --privateKey ${userProof.privateKey} --merkleRoot ${merkleRoot} --proof '${JSON.stringify(userProof.proof)}' --amount ${userProof.amount.toString()}`)}`,
      );
    });
  } catch (error) {
    console.error(
      `\n${red("Error inserting competition and rewards:")}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
insertCompetitionAndRewards();
