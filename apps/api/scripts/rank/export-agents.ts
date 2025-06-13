#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export all agents table entries as JSON file
 */
async function exportAgents(): Promise<void> {
  console.log("🚀 Exporting agents table to JSON...");

  try {
    // Fetch all agents from database
    const allAgents = await db.select().from(agents);
    console.log(`Found ${allAgents.length} agents in database`);

    // Define output path
    const outputPath = path.join(__dirname, "agents-export.json");

    // Write to JSON file with pretty formatting
    fs.writeFileSync(outputPath, JSON.stringify(allAgents, null, 2), "utf-8");

    console.log(
      `✅ Successfully exported ${allAgents.length} agents to: ${outputPath}`,
    );
    console.log("🎉 Export completed!");
  } catch (error) {
    console.error("❌ Error exporting agents:", error);
    process.exit(1);
  }
}

// Run the export
exportAgents().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
