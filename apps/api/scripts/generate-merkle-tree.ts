import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import fs from "fs";
import Papa from "papaparse";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { isAddress } from "viem";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";

import { db } from "@/database/db.js";
import { logger } from "@/lib/logger.js";

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

interface Allocation {
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

// Helper function to parse boolean values from CSV
const parseBooleanFromCsv = (value: string | undefined): boolean => {
  return value === "1" || value?.toLowerCase() === "true";
};

// Helper function to prompt user for confirmation
// async function promptUser(question: string): Promise<boolean> {
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });

//   return new Promise((resolve) => {
//     rl.question(question, (answer) => {
//       rl.close();
//       resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
//     });
//   });
// }

// TODO: in the airdrop app we can nuke the db and reload from the csv because
//  the data is fixed. Now we are going to update the airdrop each month. need
//  to figure out if this nuke and reload strat will continue to work.
// async function clearExistingData(): Promise<void> {
//   console.log("🗑️  Clearing existing data...");
//   try {
//     // Clear allocations table
//     await db.delete(schema.airdropAllocations);
//   } catch (err) {
//     console.log("could not delete airdrop_allocations table:", err);
//     // Ask for confirmation before clearing allocations table
//     const confirmAllocations = await promptUser(
//       "⚠️  Do you want to continue even though the airdrop_allocations table cannot be deleted? (y/n): ",
//     );
//     if (!confirmAllocations) {
//       throw err;
//     }
//   }
//   try {
//     // Clear metadata table
//     await db.delete(schema.merkleMetadata);
//   } catch (err) {
//     console.log("could not delete merkle_metadata table:", err);
//     const confirmMetadata = await promptUser(
//       "⚠️  Do you want to continue even though the merkle_metadata table cannot be deleted? (y/n): ",
//     );
//     if (!confirmMetadata) {
//       throw err;
//     }
//   }
//   console.log("✅ Existing data cleared");
// }

// Create repository instance
const airdropRepository = new AirdropRepository(
  db,
  logger.child({ module: "AirdropRepository" }),
);

function processAirdropFile(): Promise<void> {
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      filename: {
        type: "string",
        short: "f",
        description: "CSV filename to process",
      },
      nextName: {
        type: "string",
        short: "n",
        description: "Next season name",
      },
      help: {
        type: "boolean",
        short: "h",
        description: "Show help",
      },
    },
  });

  if (values.help) {
    console.log(`
${colors.cyan}Generate Merkle Tree for Next Season Eligibility for Conviction Claims Airdrop${colors.reset}

Usage: pnpm generate-merkle-tree.ts --filename <filename> --nextName <next-season-name>

Options:
  -f, --filename  CSV filename to process with format airdrop_<season-number>_<iso-timestamp>.csv (required)
  -n, --nextName  Next season name (required)
  -h, --help      Show this help message

Examples:
  pnpm tsx generate-merkle-tree.ts --filename ./data/airdrop_2_2024-12-31T00:00:00Z.csv --nextName "Januaray 2025"
`);
    process.exit(0);
  }

  // Validate arguments
  if (!values.filename) {
    console.error(`${colors.red}Error: --filename is required${colors.reset}`);
    process.exit(1);
  }

  if (!values.nextName) {
    console.error(`${colors.red}Error: --nextName is required${colors.reset}`);
    process.exit(1);
  }

  const pathParts = values.filename.split("/");
  const filename = pathParts[pathParts.length - 1];
  const filenameParts = filename?.split("_");
  if (filenameParts?.length !== 3) {
    console.error(`${colors.red}Error: Invalid filename format${colors.reset}`);
    process.exit(1);
  }

  const seasonString = filenameParts[1]!;
  const timestampString = filenameParts[2]!;
  const nextSeasonName = values.nextName;

  const seasonNumber = parseInt(seasonString);
  if (isNaN(seasonNumber) || seasonNumber < 0) {
    console.error(
      `${colors.red}Error: Invalid season number in filename${colors.reset}`,
    );
    process.exit(1);
  }

  const referenceTime = new Date(timestampString);
  if (isNaN(referenceTime.getTime())) {
    console.error(
      `${colors.red}Error: Invalid time format in filename. Use ISO format like airdrop_2_2024-12-31T00:00:00Z.csv${colors.reset}`,
    );
    process.exit(1);
  }

  const INPUT_FILE_PATH = path.join(__dirname, values.filename);

  const recipients: Recipient[] = [];
  let headersValidated = false;

  const fileStream = fs.createReadStream(INPUT_FILE_PATH);

  console.log(`📂 Processing airdrop file: ${INPUT_FILE_PATH}`);

  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(fileStream, {
      header: true,
      skipEmptyLines: true,
      worker: false, // Must be false for node streams
      step: (results: Papa.ParseStepResult<CsvRow>) => {
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

        if (results.errors && results.errors.length > 0) {
          const error = `Parsing error near row ${results.meta.cursor}: ${results.errors[0]?.message}`;
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

          // Prepare allocations data with proofs
          const allocations: Allocation[] = [];
          for (const [i, value] of tree.entries()) {
            const [address] = value;
            const recipient = recipients[i];
            if (!recipient) {
              throw new Error(`No recipient found at index ${i}`);
            }
            allocations.push({
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

          // Save to database using repository
          console.log("💾 Saving to database...");

          // TODO: Add clearAllData method to repository if you want to clear existing data first

          await db.transaction(async (tx) => {
            await airdropRepository.insertAllocationsBatch(
              allocations,
              undefined,
              tx,
            );
            await airdropRepository.upsertMetadata(metadata, tx);
            await airdropRepository.newSeason(
              {
                number: seasonNumber + 1,
                startDate: referenceTime,
                name: nextSeasonName,
              },
              tx,
            );
          });

          console.log("✅ Data successfully saved to database!");
          resolve();
        } catch (e) {
          console.error("❌ Merkle tree generation failed:", e);
          reject(e);
        }
      },
      error: (err: Error) => {
        reject(err);
      },
    });
  });
}

// Main execution
async function main(): Promise<void> {
  try {
    // Process the airdrop file and save to database
    await processAirdropFile();

    console.log("✅ Script completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error generating Merkle tree:", err);
    process.exit(1);
  }
}

main();
