#!/usr/bin/env tsx
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import { agentRank } from "@/database/schema/ranking/defs.js";

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

// Target competition ID for current agent ranks
const TARGET_COMPETITION_ID = "83b3a7bf-a937-41bd-ab6e-3717f6f7589a";

/**
 * Main migration function for agent rank (current rankings)
 */
async function migrateAgentRank(): Promise<void> {
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                    AGENT RANK MIGRATION                       ║",
  );
  console.log(
    "║                    CURRENT RANKINGS                           ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n",
  );

  // Load ratings data
  const dataPath = path.join(__dirname, "all_ratings_tidy.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const ratingsData: RatingData[] = JSON.parse(rawData);
  console.log(`Loaded ${ratingsData.length} rating records`);

  // Filter for target competition only
  const competitionData = ratingsData.filter(
    (record) => record.competition === TARGET_COMPETITION_ID,
  );
  console.log(
    `Found ${competitionData.length} records for competition ${TARGET_COMPETITION_ID}`,
  );

  // Get current count in database
  const currentCount = await db.select().from(agentRank);
  console.log(`Current agent rank records in database: ${currentCount.length}`);

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

  console.log("Starting agent rank migration...");
  console.log("============================================================");

  // Filter out records that don't have the required data
  const validRecords = competitionData.filter((record) => {
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
    `Filtered to ${validRecords.length} valid records (skipped ${competitionData.length - validRecords.length} placeholder records)`,
  );

  // Process each record individually since we need upsert behavior
  for (let i = 0; i < validRecords.length; i++) {
    const record = validRecords[i]!;

    if ((i + 1) % 10 === 0) {
      console.log(`Processing record ${i + 1}/${validRecords.length}`);
    }

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
      if (i < 10) {
        console.log(`  ⚠️  Could not find agent for name: "${lookupName}"`);
      }
      skippedCount++;
      continue;
    }

    // Prepare data for upsert
    const rankData = {
      id: uuidv4(),
      agentId: agentId,
      mu: parseFloat(record.mu),
      sigma: parseFloat(record.sigma),
      ordinal: parseFloat(record.ordinal),
    };

    try {
      // Use upsert to handle unique constraint on agentId
      await db
        .insert(agentRank)
        .values(rankData)
        .onConflictDoUpdate({
          target: agentRank.agentId,
          set: {
            mu: rankData.mu,
            sigma: rankData.sigma,
            ordinal: rankData.ordinal,
            updatedAt: new Date(),
          },
        });

      successCount++;

      if (i < 10) {
        console.log(`  ✓ Upserted agent rank for: ${lookupName}`);
      }
    } catch (error) {
      console.log(`  ✗ Error upserting rank for ${lookupName}: ${error}`);
      errorCount++;
    }
  }

  console.log("\n============================================================");
  console.log("✓ AGENT RANK MIGRATION COMPLETED");
  console.log("\nMigration Summary:");
  console.log(
    "────────────────────────────────────────────────────────────────",
  );
  console.log(`Total Records Processed: ${validRecords.length}`);
  console.log(`Agent Rank Records Created/Updated: ${successCount}`);
  console.log(`Records Skipped (no matching agent): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(
    "────────────────────────────────────────────────────────────────",
  );

  const successRate = ((successCount / validRecords.length) * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);

  // Final verification
  const finalCount = await db.select().from(agentRank);
  console.log(`\nFinal agent rank count in database: ${finalCount.length}`);
  console.log(`Previous count: ${currentCount.length}`);
  console.log(`Net change: ${finalCount.length - currentCount.length}`);

  console.log(`\nAgent rank migration completed successfully!`);
  console.log(
    `Current rankings from competition ${TARGET_COMPETITION_ID} have been migrated to agent_rank table.`,
  );
  console.log("\n🎉 AGENT RANK MIGRATION FINISHED! 🎉");
}

// Run the migration
migrateAgentRank().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
