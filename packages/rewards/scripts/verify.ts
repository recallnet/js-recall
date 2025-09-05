#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { calculateRewardsForUsers } from "../src/index.js";
import type {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
} from "../src/types.js";

/**
 * Get current memory usage in a human-readable format
 */
function getMemoryUsage(): {
  rss: string;
  heapUsed: string;
  heapTotal: string;
  external: string;
} {
  const memUsage = process.memoryUsage();
  const formatBytes = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return {
    rss: formatBytes(memUsage.rss), // Resident Set Size
    heapUsed: formatBytes(memUsage.heapUsed), // V8 heap used
    heapTotal: formatBytes(memUsage.heapTotal), // V8 heap total
    external: formatBytes(memUsage.external), // External memory
  };
}

/**
 * Log memory usage with a descriptive label
 */
function logMemoryUsage(label: string): void {
  const memory = getMemoryUsage();
  console.log(`\n📊 Memory Usage (${label}):`);
  console.log(`   RSS: ${memory.rss}`);
  console.log(`   Heap Used: ${memory.heapUsed}`);
  console.log(`   Heap Total: ${memory.heapTotal}`);
  console.log(`   External: ${memory.external}`);
}

/**
 * Interface for the sample data structure
 */
interface SampleData {
  prizePool: string;
  leaderBoard: Array<{
    competitor: string;
    rank: number;
  }>;
  window: {
    start: string;
    end: string;
  };
  boostAllocations: Array<{
    user: string;
    competitor: string;
    boost: number;
    timestamp: string;
  }>;
}

/**
 * Parse boost allocations from the sample data format
 */
function parseBoostAllocations(
  allocations: SampleData["boostAllocations"],
): BoostAllocation[] {
  return allocations.map((allocation) => ({
    user: allocation.user,
    competitor: allocation.competitor,
    boost: allocation.boost,
    timestamp: new Date(allocation.timestamp),
  }));
}

/**
 * Parse the time window from the sample data format
 */
function parseWindow(window: SampleData["window"]): BoostAllocationWindow {
  return {
    start: new Date(window.start),
    end: new Date(window.end),
  };
}

/**
 * Format a bigint amount for display
 */
function formatAmount(amount: bigint): string {
  return amount.toString();
}

/**
 * Main verification script
 */
async function main() {
  try {
    console.log("Starting rewards verification script...\n");

    // Log initial memory usage
    logMemoryUsage("Script Start");

    // Get filename from command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error("Usage: node verify.ts <filename>");
      console.error("Example: node verify.ts examples/sample-data.json");
      process.exit(1);
    }

    const filename = args[0]!; // Non-null assertion since we check length above
    const sampleDataPath = join(process.cwd(), filename);
    console.log(`Reading sample data from: ${sampleDataPath}`);

    const sampleDataRaw = readFileSync(sampleDataPath, "utf-8");
    const sampleData: SampleData = JSON.parse(sampleDataRaw);

    console.log("Sample data loaded successfully\n");

    // Log memory usage after loading data
    logMemoryUsage("After Loading Sample Data");

    // Parse the data
    const prizePool = BigInt(sampleData.prizePool);
    const leaderBoard: Leaderboard = sampleData.leaderBoard;
    const window = parseWindow(sampleData.window);
    const boostAllocations = parseBoostAllocations(sampleData.boostAllocations);

    // Log memory usage after parsing data
    logMemoryUsage("After Parsing Data");

    // Log input data
    console.log("Input Data:");
    console.log(`   Prize Pool: ${formatAmount(prizePool)} WEI`);
    console.log(
      `   Leaderboard: ${leaderBoard.map((p: { competitor: string; rank: number }) => `${p.competitor} (rank ${p.rank})`).join(" → ")}`,
    );
    console.log(
      `   Window: ${window.start.toISOString()} to ${window.end.toISOString()}`,
    );
    console.log(`   Boost Allocations: ${boostAllocations.length} entries`);
    console.log("");

    // Calculate rewards
    console.log("Calculating rewards...");
    const startTime = Date.now();

    const intermediateSteps: Record<string, unknown>[] = [];
    const rewards = calculateRewardsForUsers(
      prizePool,
      boostAllocations,
      leaderBoard,
      window,
      0.5,
      0.5,
      (info: Record<string, unknown>) => intermediateSteps.push(info),
    );

    const endTime = Date.now();
    const calculationTime = endTime - startTime;

    console.log(`Rewards calculated in ${calculationTime}ms\n`);

    // Log memory usage after calculation
    logMemoryUsage("After Rewards Calculation");

    // Display intermediate calculations
    console.log("Intermediate Calculations:");
    console.log("=".repeat(50));

    intermediateSteps.forEach((calc, index) => {
      console.log(`\n   Step ${index + 1}:`);
      Object.entries(calc).forEach(([key, value]) => {
        if (key === "prizePoolSplits") {
          console.log(`     Prize Pool Splits:`);
          Object.entries(value as Record<string, unknown>).forEach(
            ([competitor, split]) => {
              console.log(
                `       ${competitor}: ${(split as { toString(): string }).toString()} WEI`,
              );
            },
          );
        } else if (key === "userTotals") {
          console.log(`     User Totals (Effective Boost):`);
          Object.entries(
            value as Record<string, Record<string, unknown>>,
          ).forEach(([user, competitors]) => {
            console.log(`       ${user}:`);
            Object.entries(competitors).forEach(([competitor, boost]) => {
              console.log(
                `         ${competitor}: ${(boost as { toString(): string }).toString()}`,
              );
            });
          });
        } else if (key === "competitorTotals") {
          console.log(`     Competitor Totals (Real Boost):`);
          Object.entries(value as Record<string, unknown>).forEach(
            ([competitor, total]) => {
              console.log(
                `       ${competitor}: ${(total as { toString(): string }).toString()}`,
              );
            },
          );
        } else if (key === "rewards") {
          console.log(`     Final Rewards:`);
          (value as unknown[]).forEach((reward: unknown, idx: number) => {
            const rewardObj = reward as { address: string; amount: bigint };
            console.log(
              `       ${idx + 1}. ${rewardObj.address}: ${formatAmount(rewardObj.amount)} WEI`,
            );
          });
        }
      });
    });

    // Display final results
    console.log("\nFinal Rewards Distribution:");
    console.log("=".repeat(50));

    if (rewards.length === 0) {
      console.log("   No rewards to distribute");
    } else {
      let totalDistributed = BigInt(0);

      rewards.forEach(
        (reward: { address: string; amount: bigint }, index: number) => {
          console.log(
            `   ${index + 1}. ${reward.address}: ${formatAmount(reward.amount)} WEI`,
          );
          totalDistributed += reward.amount;
        },
      );

      console.log("");
      console.log(
        `   Total Distributed: ${formatAmount(totalDistributed)} WEI`,
      );
      console.log(
        `   Remaining: ${formatAmount(prizePool - totalDistributed)} WEI`,
      );
    }

    console.log("");

    // Log final memory usage
    logMemoryUsage("Script Completion");

    console.log("Verification script completed successfully!");
  } catch (error) {
    console.error("Error during verification:", error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
