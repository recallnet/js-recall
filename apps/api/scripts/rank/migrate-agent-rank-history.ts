#!/usr/bin/env tsx
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import { agentRankHistory } from "@/database/schema/ranking/defs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RatingData {
  competition: string;
  name: string;
  mu: string;
  sigma: string;
  ordinal: string;
  rank: string;
  team_name: string;
  team_id: string;
  agent_name: string;
  agent_id: string;
  value: string;
}

/**
 * Main migration function for agent rank history
 */
async function migrateAgentRankHistory(): Promise<void> {
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                 AGENT RANK HISTORY MIGRATION                  ║",
  );
  console.log(
    "║                         BACKFILL PHASE                        ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n",
  );

  // Load ratings data
  const dataPath = path.join(__dirname, "all_ratings_tidy.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const ratingsData: RatingData[] = JSON.parse(rawData);
  console.log(`Loaded ${ratingsData.length} rating records`);

  // Get current count in database
  const currentCount = await db.select().from(agentRankHistory);
  console.log(
    `Current agent rank history records in database: ${currentCount.length}`,
  );

  // Load all agents for lookup
  const allAgents = await db.select().from(agents);
  console.log(`Found ${allAgents.length} agents in database`);

  // Create lookup map for agents by name (case-insensitive)
  const agentLookup = new Map<string, string>();
  allAgents.forEach((agent) => {
    agentLookup.set(agent.name.toLowerCase(), agent.id);
  });

  // Initialize counters
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  console.log("Starting agent rank history migration...");
  console.log("============================================================");

  // Filter out records that don't have the required data
  const validRecords = ratingsData.filter((record) => {
    // Skip records with empty mu, sigma, ordinal (these seem to be placeholder entries)
    if (
      !record.mu ||
      !record.sigma ||
      !record.ordinal ||
      record.mu === "25.0"
    ) {
      return false;
    }
    return true;
  });

  console.log(
    `Filtered to ${validRecords.length} valid records (skipped ${ratingsData.length - validRecords.length} placeholder records)`,
  );

  // Process in batches for better performance
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(validRecords.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, validRecords.length);
    const batch = validRecords.slice(startIndex, endIndex);

    console.log(
      `[Batch ${batchIndex + 1}/${totalBatches}] Processing records ${startIndex + 1}-${endIndex}`,
    );

    // Prepare batch data
    const batchValues = [];

    for (const record of batch) {
      // Determine which name to use for agent lookup
      let lookupName = "";
      if (record.agent_name && record.agent_name.trim()) {
        lookupName = record.agent_name.trim();
      } else if (record.team_name && record.team_name.trim()) {
        lookupName = record.team_name.trim();
      } else if (record.name && record.name.trim()) {
        lookupName = record.name.trim();
      }

      if (!lookupName) {
        skippedCount++;
        continue;
      }

      // Look up agent ID
      const agentId = agentLookup.get(lookupName.toLowerCase());
      if (!agentId) {
        if (batchIndex < 3) {
          console.log(`  ⚠️  Could not find agent for name: "${lookupName}"`);
        }
        skippedCount++;
        continue;
      }

      batchValues.push({
        id: uuidv4(),
        agentId: agentId,
        competitionId: record.competition,
        mu: parseFloat(record.mu),
        sigma: parseFloat(record.sigma),
        ordinal: parseFloat(record.ordinal),
      });
    }

    // Insert the batch
    if (batchValues.length > 0) {
      try {
        await db.insert(agentRankHistory).values(batchValues);
        successCount += batchValues.length;

        if (batchIndex < 5) {
          console.log(
            `  ✓ Inserted ${batchValues.length} agent rank history records`,
          );
        }
      } catch (error) {
        console.log(`  ✗ Error inserting batch: ${error}`);
        errorCount += batchValues.length;
      }
    }

    // Progress update every 20 batches
    if ((batchIndex + 1) % 20 === 0) {
      const processed = Math.min(endIndex, validRecords.length);
      const progressPercent = ((processed / validRecords.length) * 100).toFixed(
        1,
      );
      console.log(
        `  Progress: ${processed}/${validRecords.length} (${progressPercent}%)`,
      );
    }
  }

  console.log("\n============================================================");
  console.log("✓ AGENT RANK HISTORY MIGRATION COMPLETED");
  console.log("\nMigration Summary:");
  console.log(
    "────────────────────────────────────────────────────────────────",
  );
  console.log(`Total Records Processed: ${validRecords.length}`);
  console.log(`Agent Rank History Records Created: ${successCount}`);
  console.log(`Records Skipped (no matching agent): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(
    "────────────────────────────────────────────────────────────────",
  );

  const successRate = ((successCount / validRecords.length) * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);

  // Final verification
  const finalCount = await db.select().from(agentRankHistory);
  console.log(
    `\nFinal agent rank history count in database: ${finalCount.length}`,
  );
  console.log(`Expected increase: ${successCount}`);
  console.log(`Actual increase: ${finalCount.length - currentCount.length}`);

  console.log("\nAgent rank history migration completed successfully!");
  console.log(
    "All historical ranking data has been migrated to agent_rank_history table.",
  );
  console.log("\n🎉 AGENT RANK HISTORY MIGRATION FINISHED! 🎉");
}

// Run the migration
migrateAgentRankHistory().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
