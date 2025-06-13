#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { db } from "@/database/db.js";
import { prices } from "@/database/schema/trading/defs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EthvsolPriceData {
  id: number;
  token: string;
  price: number;
  timestamp: string;
  chain: string | null;
  specific_chain: string | null;
  symbol: string;
}

/**
 * Main migration function for prices
 */
async function migrateEthvsolPrices(): Promise<void> {
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                    ETHVSOL PRICES MIGRATION                    ║",
  );
  console.log(
    "║                         FINAL PHASE                           ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n",
  );

  // Load ethvsol prices data
  const dataPath = path.join(__dirname, "ethvsol_prices_clean.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const ethvsolPrices: EthvsolPriceData[] = JSON.parse(rawData);
  console.log(`Loaded ${ethvsolPrices.length} ethvsol price records`);

  // Get current count in combined database
  const currentCount = await db.select().from(prices);
  console.log(`Current prices in combined database: ${currentCount.length}`);

  // Initialize counters
  let successCount = 0;
  let errorCount = 0;

  console.log("Starting prices migration...");
  console.log("============================================================");

  // Process in batches for better performance
  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(ethvsolPrices.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, ethvsolPrices.length);
    const batch = ethvsolPrices.slice(startIndex, endIndex);

    console.log(
      `[Batch ${batchIndex + 1}/${totalBatches}] Processing records ${startIndex + 1}-${endIndex}`,
    );

    // Prepare batch data (excluding the old ID since we'll get new auto-generated IDs)
    const batchValues = batch.map((price) => ({
      token: price.token,
      price: price.price,
      timestamp: new Date(price.timestamp),
      chain: price.chain,
      specificChain: price.specific_chain,
      symbol: price.symbol,
    }));

    // Insert the batch
    try {
      await db.insert(prices).values(batchValues);
      successCount += batchValues.length;

      if (batchIndex < 5) {
        console.log(`  ✓ Inserted ${batchValues.length} price records`);
      }
    } catch (error) {
      console.log(`  ✗ Error inserting batch: ${error}`);
      errorCount += batchValues.length;
    }

    // Progress update every 50 batches
    if ((batchIndex + 1) % 50 === 0) {
      const processed = Math.min(endIndex, ethvsolPrices.length);
      const progressPercent = (
        (processed / ethvsolPrices.length) *
        100
      ).toFixed(1);
      console.log(
        `  Progress: ${processed}/${ethvsolPrices.length} (${progressPercent}%)`,
      );
    }
  }

  console.log("\n============================================================");
  console.log("✓ ETHVSOL PRICES MIGRATION COMPLETED");
  console.log("\nMigration Summary:");
  console.log(
    "────────────────────────────────────────────────────────────────",
  );
  console.log(`Total Records Processed: ${ethvsolPrices.length}`);
  console.log(`Price Records Created: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(
    "────────────────────────────────────────────────────────────────",
  );

  const successRate = ((successCount / ethvsolPrices.length) * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);

  // Final verification
  const finalCount = await db.select().from(prices);
  console.log(`\nFinal price count in combined database: ${finalCount.length}`);
  console.log(`Expected increase: ${successCount}`);
  console.log(`Actual increase: ${finalCount.length - currentCount.length}`);

  console.log("\nEthvsol prices migration completed successfully!");
  console.log(
    "All historical price data has been migrated from ethvsol to combined database.",
  );
  console.log("\n🎉 COMPLETE ETHVSOL DATABASE MIGRATION FINISHED! 🎉");
}

// Run the migration
migrateEthvsolPrices().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
