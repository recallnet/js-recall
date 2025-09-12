import * as dotenv from "dotenv";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { encodeAbiParameters } from "viem";

import { competitions } from "@recallnet/db-schema/core/defs";
import { rewards } from "@recallnet/db-schema/voting/defs";

import { db } from "@/database/db.js";
import { createLeafNode } from "@/services/rewards.service.js";

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
 * Creates a special "faux" leaf node for a competition
 * @param competitionId The UUID of the competition
 * @returns Buffer containing the keccak256 hash of the encoded parameters with zero address and amount
 */
function createFauxLeafNode(competitionId: string): Buffer {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }],
      [
        competitionId,
        "0x0000000000000000000000000000000000000000" as `0x${string}`,
        BigInt("0"),
      ],
    ),
  );
}

/**
 * Insert one competition and three rewards into the database
 */
async function insertCompetitionAndRewards() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║              INSERTING COMPETITION AND REWARDS                 ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    // Insert competition
    const competitionId = uuidv4();

    console.log(
      `\n${colors.blue}Inserting competition with ID: ${colors.yellow}${competitionId}${colors.reset}`,
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
      `\n${colors.blue}Inserting rewards for competition: ${colors.yellow}${competitionId}${colors.reset}`,
    );

    // Insert rewards
    for (const reward of rewardsData) {
      const leafHash = createLeafNode(reward.address, reward.amount);

      await db.insert(rewards).values({
        id: uuidv4(),
        competitionId: competitionId,
        address: reward.address,
        amount: reward.amount,
        leafHash: new Uint8Array(leafHash),
        claimed: false,
      });

      console.log(
        `${colors.green}Inserted reward for address: ${colors.yellow}${reward.address}${colors.reset} with amount: ${colors.yellow}${reward.amount.toString()}${colors.reset}`,
      );
      console.log(
        `${colors.magenta}Private key: ${colors.yellow}${reward.privateKey}${colors.reset}`,
      );
    }

    console.log(
      `\n${colors.green}Successfully inserted competition and rewards.${colors.reset}`,
    );
    console.log(
      `${colors.green}Competition ID: ${colors.yellow}${competitionId}${colors.reset}`,
    );
    console.log(
      `${colors.green}You can now run: ${colors.yellow}pnpm rewards:allocate ${competitionId}${colors.reset}`,
    );

    // Generate Merkle tree and proofs
    console.log(
      `\n${colors.blue}Generating Merkle tree and proofs...${colors.reset}`,
    );

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

    console.log(
      `${colors.green}Merkle Root: ${colors.yellow}${merkleRoot}${colors.reset}`,
    );

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
      `\n${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                    MERKLE TREE & PROOFS SUMMARY               ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\n${colors.green}Merkle Root: ${colors.yellow}${merkleRoot}${colors.reset}`,
    );

    userProofs.forEach((userProof, index) => {
      console.log(`\n${colors.blue}Reward ${index + 1}:${colors.reset}`);
      console.log(
        `${colors.yellow}Address: ${colors.reset}${userProof.address}`,
      );
      console.log(
        `${colors.yellow}Private Key: ${colors.reset}${userProof.privateKey}`,
      );
      console.log(
        `${colors.yellow}Amount: ${colors.reset}${userProof.amount.toString()}`,
      );
      console.log(
        `${colors.yellow}Leaf Hash: ${colors.reset}0x${leafHashes[index]!.toString("hex")}`,
      );
      console.log(
        `${colors.yellow}Proof: ${colors.reset}[${userProof.proof.join(", ")}]`,
      );
    });

    // Print ready-to-use claim commands for each user
    console.log(
      `\n${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                    READY-TO-USE CLAIM COMMANDS                 ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    userProofs.forEach((userProof, index) => {
      console.log(
        `\n${colors.green}User ${index + 1} Claim Command:${colors.reset}`,
      );
      console.log(
        `${colors.yellow}pnpm rewards:claim ${userProof.privateKey} ${merkleRoot} '${JSON.stringify(userProof.proof)}' ${userProof.amount.toString()}${colors.reset}`,
      );
    });
  } catch (error) {
    console.error(
      `\n${colors.red}Error inserting competition and rewards:${colors.reset}`,
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
