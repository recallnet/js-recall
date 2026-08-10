/**
 * Airdrop seeding for local development.
 *
 * This module seeds the database with:
 * - Season records
 * - Airdrop allocations with merkle proofs
 *
 * The data matches the pre-generated merkle tree in:
 * packages/staking-contracts/contracts/deploy/06_deploy_Airdrop.ts
 *
 * This ensures the database allocations match the on-chain merkle root,
 * allowing users to claim their airdrops in local development.
 */
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

import { log } from "./utils.js";

/**
 * Airdrop amount per account in wei (1000 tokens with 18 decimals)
 */
const AIRDROP_AMOUNT = "1000000000000000000000";

/**
 * Season configuration for local development
 */
const SEASON_CONFIG = {
  number: 1,
  name: "Season 1 - Local Dev",
  // Start date: 30 days ago to ensure claims are available
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  // End date: 60 days from now to give plenty of time for testing
  endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
};

/**
 * Pre-generated merkle tree allocations for Anvil test accounts.
 * This data MUST match the MERKLE_DATA in 06_deploy_Airdrop.ts
 *
 * Generated using @openzeppelin/merkle-tree with leaf format: [address, uint256, uint8]
 * Merkle root: 0x99341db4a72623b4f268048ed9f02ff92894fc9a5fa6409107188ce968975a78
 */
const AIRDROP_ALLOCATIONS = [
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x2ec4da4988bb66de7743d4a19781bbc1980457637476d75591f7bb70b9cbfa1f",
      "0xe94a3b471459e094ada06591313c398e0998ae7b2d7e73f530b63f19209ec905",
      "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
      "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
    ],
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x4252241a9778f2c2311eccc8ede06d33dd43634b2c9d189e2329521844d2751c",
      "0x9b607ce2292d9364e70ecff38464eb9628bc1d29d63fe209cb3adb0be2c96f16",
      "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
    ],
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x816959b655d7a738e9133c4da197c9216275aeffbfd8b5d0211db7aff3e67e59",
      "0x1b352034f678a35a2a4a4d7f4268024cfe5018c7abc82bec996ebadecbbb724a",
      "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
    ],
  },
  {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x2ba4f1572bef52adc1c30814a3ffc0c82676864936894d0e1e589e2c9452fb3e",
      "0xe94a3b471459e094ada06591313c398e0998ae7b2d7e73f530b63f19209ec905",
      "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
      "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
    ],
  },
  {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0xa53e1ae347715706a20c79c504276f022e53c80e9cdaf83335d7872d1c5ad511",
      "0x1b352034f678a35a2a4a4d7f4268024cfe5018c7abc82bec996ebadecbbb724a",
      "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
    ],
  },
  {
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x59240a656f3afa317b5d58ffb64c1fc77acfc70ff3c76c6813c37a9cbb46a6c2",
      "0x9b607ce2292d9364e70ecff38464eb9628bc1d29d63fe209cb3adb0be2c96f16",
      "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
    ],
  },
  {
    address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x297feef0f89b2a11887d1c026ba3eb78e59589d9d153861d7965fb5bdc48324f",
      "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
      "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
    ],
  },
  {
    address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x6858d00d8cac502f0fa45439e77efa0723109e1b4ba8ec8a361e888a48612651",
      "0xe753dde72635fd59cdbd7105dff0df3336584e09e665421cbff0141d44608df6",
      "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
    ],
  },
  {
    address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    amount: AIRDROP_AMOUNT,
    season: 1,
    proof: [
      "0x6f1987f7db23a0707624f825ec29266245644dd5376eaa64dd80c4bfdef84032",
      "0xe753dde72635fd59cdbd7105dff0df3336584e09e665421cbff0141d44608df6",
      "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
    ],
  },
];

/**
 * Seed the seasons table
 */
async function seedSeason(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  log("Seeding seasons...");

  // Check if season already exists
  const existing = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.number, SEASON_CONFIG.number))
    .limit(1);

  if (existing.length > 0) {
    log(`Season ${SEASON_CONFIG.number} already exists, skipping`, "info");
    return;
  }

  await db.insert(schema.seasons).values({
    number: SEASON_CONFIG.number,
    name: SEASON_CONFIG.name,
    startDate: SEASON_CONFIG.startDate,
    endDate: SEASON_CONFIG.endDate,
  });

  log(`Created season: ${SEASON_CONFIG.name}`, "success");
}

/**
 * Seed the airdrop allocations table
 */
async function seedAllocations(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  log("Seeding airdrop allocations...");

  let created = 0;
  let skipped = 0;

  for (const allocation of AIRDROP_ALLOCATIONS) {
    const normalizedAddress = allocation.address.toLowerCase();

    // Check if allocation already exists
    const existing = await db
      .select()
      .from(schema.airdropAllocations)
      .where(eq(schema.airdropAllocations.address, normalizedAddress))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(schema.airdropAllocations).values({
      address: normalizedAddress,
      amount: BigInt(allocation.amount),
      season: allocation.season,
      proof: allocation.proof,
      category: "local-dev",
      sybilClassification: "approved",
      powerUser: false,
      recallSnapper: false,
      aiBuilder: false,
      aiExplorer: false,
    });

    created++;
  }

  if (skipped > 0) {
    log(`Skipped ${skipped} existing allocations`, "info");
  }
  log(`Created ${created} airdrop allocations`, "success");
}

/**
 * Seed airdrop data for local development
 *
 * This creates:
 * - Season record for season 1
 * - Airdrop allocations for 9 Anvil test accounts (accounts 1-9, skipping deployer)
 *
 * Each account can claim 1000 tokens using their merkle proof.
 */
export async function seedAirdrop(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  log("=".repeat(40));
  log("Seeding airdrop data...");
  log("=".repeat(40));

  try {
    // Seed season first (allocations reference it)
    await seedSeason(db);

    // Seed allocations
    await seedAllocations(db);

    log("");
    log("Airdrop seeding complete!", "success");
    log(`  Season: ${SEASON_CONFIG.name}`);
    log(`  Allocations: ${AIRDROP_ALLOCATIONS.length} accounts`);
    log(`  Amount per account: 1000 tokens`);
    log("");
  } catch (error) {
    log(`Failed to seed airdrop: ${error}`, "error");
    throw error;
  }
}
