import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "fs";
import Papa from "papaparse";
import path from "path";
import pg from "pg";
import readline from "readline";
import { fileURLToPath } from "url";
import { isAddress } from "viem";

import * as schema from "../src/db/schema";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const { Pool } = pg;

// Types
interface Recipient {
  address: string;
  amount: bigint;
  season: number;
  category: string;
  sybilClassification: string;
  flaggedAt: string | null;
  flaggingReason: string | null;
  powerUser: boolean;
  recallSnapper: boolean;
  aiBuilder: boolean;
  aiExplorer: boolean;
}

interface Claim {
  address: string;
  amount: string;
  season: number;
  proof: string[];
  category: string;
  sybilClassification: string;
  flaggedAt: string | null;
  flaggingReason: string | null;
  powerUser: boolean;
  recallSnapper: boolean;
  aiBuilder: boolean;
  aiExplorer: boolean;
}

interface MerkleMetadata {
  merkleRoot: string;
  totalAmount: string;
  totalRows: number;
  uniqueAddresses: number;
}

interface CsvRow {
  address?: string;
  amount?: string;
  season?: string;
  category?: string;
  sybilClassification?: string;
  flaggedAt?: string;
  flaggingReason?: string;
  powerUser?: string;
  recallSnapper?: string;
  aiBuilder?: string;
  aiExplorer?: string;
}

// Constants
const INPUT_FILE_PATH = "./data/airdrop-data.csv";
const EXPECTED_HEADERS = ["address", "amount", "season"];
const OPTIONAL_HEADERS = [
  "category",
  "sybilClassification",
  "flaggedAt",
  "flaggingReason",
  "powerUser",
  "recallSnapper",
  "aiBuilder",
  "aiExplorer",
];
const VALID_SYBIL_CLASSIFICATIONS = ["approved", "maybe-sybil", "sybil"];

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

// Create the drizzle instance with schema
export const db = drizzle(pool, { schema });

// Helper function to parse boolean values from CSV
const parseBooleanFromCsv = (value: string | undefined): boolean => {
  return value === "1" || value?.toLowerCase() === "true";
};

// Helper function to prompt user for confirmation
async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function clearExistingData(): Promise<void> {
  console.log("🗑️  Clearing existing data...");
  try {
    // Clear claims table
    await db.delete(schema.airdropClaims);
  } catch (err) {
    console.log("could not delete airdrop_claims table:", err);
    // Ask for confirmation before clearing claims table
    const confirmClaims = await promptUser(
      "⚠️  Do you want to continue even though the airdrop_claims table cannot be deleted? (y/n): ",
    );
    if (!confirmClaims) {
      throw err;
    }
  }
  try {
    // Clear metadata table
    await db.delete(schema.merkleMetadata);
  } catch (err) {
    console.log("could not delete merkle_metadata table:", err);
    const confirmMetadata = await promptUser(
      "⚠️  Do you want to continue even though the merkle_metadata table cannot be deleted? (y/n): ",
    );
    if (!confirmMetadata) {
      throw err;
    }
  }
  console.log("✅ Existing data cleared");
}

async function insertClaimsInBatches(
  claims: Claim[],
  batchSize: number = 1000,
): Promise<void> {
  console.log(
    `📦 Inserting ${claims.length} claims in batches of ${batchSize}...`,
  );

  for (let i = 0; i < claims.length; i += batchSize) {
    const batch = claims.slice(i, i + batchSize);

    // Prepare batch data for insertion
    const values = batch.map((claim) => ({
      address: claim.address.toLowerCase(),
      amount: claim.amount,
      season: claim.season,
      proof: JSON.stringify(claim.proof),
      category: claim.category || "",
      sybilClassification: claim.sybilClassification || "approved",
      flaggedAt: claim.flaggedAt || undefined,
      flaggingReason: claim.flaggingReason || undefined,
      powerUser: claim.powerUser,
      recallSnapper: claim.recallSnapper,
      aiBuilder: claim.aiBuilder,
      aiExplorer: claim.aiExplorer,
    }));

    // Execute batch insert with ON CONFLICT DO UPDATE
    await db.insert(schema.airdropClaims).values(values);

    console.log(
      `  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(claims.length / batchSize)}`,
    );
  }

  console.log("✅ All claims inserted");
}

async function insertMetadata(metadata: MerkleMetadata): Promise<void> {
  console.log("📊 Inserting merkle metadata...");

  await db.insert(schema.merkleMetadata).values({
    id: 1, // Always use ID 1 for single-row metadata
    merkleRoot: metadata.merkleRoot,
    totalAmount: metadata.totalAmount,
    totalRows: metadata.totalRows,
    uniqueAddresses: metadata.uniqueAddresses,
  });

  console.log("✅ Metadata inserted");
}

function processAirdropFile(): Promise<void> {
  const recipients: Recipient[] = [];
  let headersValidated = false;

  const fileStream = fs.createReadStream(INPUT_FILE_PATH);

  console.log(`📂 Processing airdrop file: ${INPUT_FILE_PATH}`);

  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(fileStream, {
      header: true,
      skipEmptyLines: true,
      worker: false, // Must be false for node streams
      step: (results) => {
        const row = results.data;

        // We only need to validate the headers for one row since this is a CSV
        if (!headersValidated) {
          const headers = Object.keys(row);
          if (!EXPECTED_HEADERS.every((h) => headers.includes(h))) {
            const error = `Invalid headers. Required: ${EXPECTED_HEADERS.join(
              ", ",
            )}. Optional: ${OPTIONAL_HEADERS.join(", ")}. Found: ${headers.join(", ")}.`;
            return reject(new Error(error));
          }
          headersValidated = true;
        }

        if (results.errors.length > 0) {
          const error = `Parsing error near row ${results.meta.cursor}: ${results.errors[0].message}`;
          return reject(new Error(error));
        }

        const address = row.address?.trim();
        const amount = row.amount?.trim();
        const season = row.season?.trim();

        // Optional fields
        const category = row.category?.trim() || "";
        // TODO: should we be defaulting to "approved"? Need to ask Sam
        const sybilClassification =
          row.sybilClassification?.trim() || "approved";
        const flaggedAt = row.flaggedAt?.trim() || "";
        const flaggingReason = row.flaggingReason?.trim() || "";

        // Parse eligibility flags
        const powerUser = parseBooleanFromCsv(row.powerUser?.trim());
        const recallSnapper = parseBooleanFromCsv(row.recallSnapper?.trim());
        const aiBuilder = parseBooleanFromCsv(row.aiBuilder?.trim());
        const aiExplorer = parseBooleanFromCsv(row.aiExplorer?.trim());

        if (!address || !isAddress(address)) {
          const error = `Invalid address near row ${results.meta.cursor}: ${address}`;
          return reject(new Error(error));
        }
        if (!amount || isNaN(Number(amount)) || BigInt(amount) < 0) {
          const error = `Invalid amount for address ${address}: ${amount}`;
          return reject(new Error(error));
        }
        if (
          season === undefined ||
          isNaN(Number(season)) ||
          !Number.isInteger(Number(season)) ||
          Number(season) < 0
        ) {
          const error = `Invalid or missing season for address ${address}: ${season}`;
          return reject(new Error(error));
        }

        // Validate sybil classification if provided
        if (
          sybilClassification &&
          !VALID_SYBIL_CLASSIFICATIONS.includes(sybilClassification)
        ) {
          const error = `Invalid sybilClassification for address ${address}: ${sybilClassification}. Valid values: ${VALID_SYBIL_CLASSIFICATIONS.join(", ")}`;
          return reject(new Error(error));
        }

        // Validate flaggedAt if provided (should be ISO 8601 format or empty)
        if (flaggedAt && flaggedAt !== "") {
          try {
            new Date(flaggedAt).toISOString();
          } catch {
            const error = `Invalid flaggedAt date format for address ${address}: ${flaggedAt}. Expected ISO 8601 format (e.g., 2024-08-01T10:30:00Z)`;
            return reject(new Error(error));
          }
        }

        recipients.push({
          address: address,
          amount: BigInt(amount),
          season: parseInt(season, 10),
          category,
          sybilClassification,
          flaggedAt: flaggedAt || null,
          flaggingReason: flaggingReason || null,
          powerUser,
          recallSnapper,
          aiBuilder,
          aiExplorer,
        });
      },
      complete: async () => {
        if (recipients.length === 0) {
          return reject(new Error("File is empty or contains no valid data."));
        }

        console.log(`✅ Successfully parsed ${recipients.length} records.`);
        console.log("🌳 Generating Merkle tree...");

        try {
          console.log("recipients.length:", recipients.length);

          const values: [string, bigint, number][] = recipients.map((r) => [
            r.address,
            r.amount,
            r.season,
          ]);

          const tree = StandardMerkleTree.of(values, [
            "address",
            "uint256",
            "uint8",
          ]);

          const uniqueAddresses = new Set(recipients.map((r) => r.address))
            .size;
          const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);

          // Prepare claims data with proofs
          const claims: Claim[] = [];
          for (const [i, value] of tree.entries()) {
            const [address] = value;
            const recipient = recipients[i];
            claims.push({
              address: address.toLowerCase(),
              amount: recipient.amount.toString(),
              season: recipient.season,
              proof: tree.getProof(i),
              category: recipient.category,
              sybilClassification: recipient.sybilClassification,
              flaggedAt: recipient.flaggedAt,
              flaggingReason: recipient.flaggingReason,
              powerUser: recipient.powerUser,
              recallSnapper: recipient.recallSnapper,
              aiBuilder: recipient.aiBuilder,
              aiExplorer: recipient.aiExplorer,
            });
          }

          // Prepare metadata
          const metadata: MerkleMetadata = {
            merkleRoot: tree.root,
            totalAmount: totalAmount.toString(),
            totalRows: recipients.length,
            uniqueAddresses: uniqueAddresses,
          };

          console.log(`🌳 Merkle tree generated successfully!`);
          console.log(`   Root: ${tree.root}`);
          console.log(`   Total Amount: ${totalAmount.toString()}`);
          console.log(`   Total Rows: ${recipients.length}`);
          console.log(`   Unique Addresses: ${uniqueAddresses}`);

          // Save to database
          await clearExistingData();
          await insertClaimsInBatches(claims);
          await insertMetadata(metadata);

          console.log("✅ Data successfully saved to database!");
          resolve();
        } catch (e) {
          console.error("❌ Merkle tree generation failed:", e);
          reject(e);
        }
      },
      error: (err) => {
        reject(err);
      },
    });
  });
}

// Main execution
async function main(): Promise<void> {
  try {
    // Test database connection, and fail early if this isn't going to work
    const testQuery = await db.execute(sql`SELECT 1 as test`);
    if (testQuery.rows[0].test !== 1) {
      throw new Error("Database cannot connect");
    }
    console.log("✅ Database connection successful");

    // Process the airdrop file and save to database
    await processAirdropFile();

    // Close database connection
    await pool.end();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error generating Merkle tree:", err);
    await pool.end();
    process.exit(1);
  }
}

main();
