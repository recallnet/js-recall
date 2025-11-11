#!/usr/bin/env tsx
import {
  BlockField,
  HypersyncClient,
  JoinMode,
  Log,
  LogField,
  Query,
  TransactionField,
} from "@envio-dev/hypersync-client";
import * as dotenv from "dotenv";
import * as path from "path";
import { decodeEventLog, encodeEventTopics } from "viem";

import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";

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

// Parse command-line arguments
const args = process.argv.slice(2);
const shouldUpdate = args.includes("--update");

/**
 * Calculate stake duration based on the claimed percentage.
 * 30 days = 20%, 90 days = 40%, 180 days = 60%, 365 days = 100%
 * @param amount The eligible amount (100%)
 * @param claimedAmount The actual amount claimed
 * @returns Duration in seconds
 */
function calculateDurationFromClaim(
  amount: bigint,
  claimedAmount: bigint,
): bigint {
  if (amount === 0n) return 0n;

  const percentage = (claimedAmount * 100n) / amount;

  // Convert days to seconds
  const DAY_IN_SECONDS = 86400n;

  if (percentage <= 20n) {
    return 30n * DAY_IN_SECONDS; // 30 days
  } else if (percentage <= 40n) {
    return 90n * DAY_IN_SECONDS; // 90 days
  } else if (percentage <= 60n) {
    return 180n * DAY_IN_SECONDS; // 180 days
  } else if (percentage === 100n) {
    return 365n * DAY_IN_SECONDS; // 365 days
  } else {
    return 0n;
  }
}

/**
 * Find Claimed events that are missing from the conviction_claims table.
 * These are likely claims triggered by custom contracts that aren't being
 * caught by the transaction-based indexer.
 */
async function findMissingClaims() {
  if (shouldUpdate) {
    console.log(
      `${colors.magenta}🔄 Running in UPDATE mode - will insert missing claims into database${colors.reset}\n`,
    );
  }

  console.log(
    `${colors.cyan}🔍 Finding missing Claimed events...\n${colors.reset}`,
  );

  // Contract address and hypersync config
  const convictionClaimsContract = config.stakingIndex.convictionClaimsContract;
  const hypersyncUrl = config.stakingIndex.hypersyncUrl;
  if (!convictionClaimsContract || !hypersyncUrl) {
    throw new Error("invalid config, need hypersync and contract");
  }

  console.log(`📋 Contract: ${convictionClaimsContract}`);
  console.log(`🌐 Hypersync URL: ${hypersyncUrl}\n`);

  // Create Hypersync client
  const client = HypersyncClient.new({ url: hypersyncUrl });

  // Define the Claimed event ABI
  const claimedEventAbi = {
    type: "event" as const,
    name: "Claimed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "claimedAmount", type: "uint256", indexed: false },
      { name: "season", type: "uint8", indexed: false },
    ],
  };

  // Get event topic
  const claimedEventTopics = encodeEventTopics({
    abi: [claimedEventAbi],
    eventName: "Claimed",
  });

  console.log(
    `🔍 Looking for Claimed event with topic: ${claimedEventTopics[0]}\n`,
  );

  // Known event signatures
  const knownEvents: Record<string, string> = {
    "0xfba955b7124801955d5218289768d39688a6c2af7c54181f5bf3b0b0e7a4aa89":
      "Claimed",
  };

  // Start from early blocks to find missing claims
  const startBlock = 35000000; // Start from the beginning
  const endBlock = 37736523;

  console.log(`📦 Scanning blocks: ${startBlock} to ${endBlock}`);

  // Create query for ALL events from the contract
  const query: Query = {
    fromBlock: startBlock,
    toBlock: endBlock,
    logs: [
      {
        address: [convictionClaimsContract],
        topics: [[claimedEventTopics[0]]], // Only get Claimed events
      },
    ],
    fieldSelection: {
      log: [
        LogField.BlockNumber,
        LogField.BlockHash,
        LogField.LogIndex,
        LogField.TransactionHash,
        LogField.Data,
        LogField.Address,
        LogField.Topic0,
        LogField.Topic1,
        LogField.Topic2,
        LogField.Topic3,
      ],
      transaction: [
        TransactionField.From,
        TransactionField.To,
        TransactionField.Hash,
        TransactionField.Input,
      ],
      block: [],
    },
    joinMode: JoinMode.JoinAll,
  };

  console.log("🚀 Fetching events from Hypersync...");
  const stream = await client.stream(query, {});

  // Collect ALL batches of results, not just the first one
  let allLogs: Log[] = [];
  let batch = 0;

  while (true) {
    const res = await stream.recv();

    if (!res || !res.data || !res.data.logs || res.data.logs.length === 0) {
      break; // No more data
    }

    batch++;
    console.log(`  Batch ${batch}: Retrieved ${res.data.logs.length} events`);
    allLogs = allLogs.concat(res.data.logs);

    // Check if we have more data to fetch
    if (!res.nextBlock || res.nextBlock > endBlock) {
      break; // We've reached the end
    }
  }

  const logs = allLogs;
  console.log(`📊 Found a total of ${logs.length} Claimed event logs\n`);

  console.log(`📊 Found a total of ${logs.length} event logs\n`);

  // Group events by topic0, i.e. the event name `Claimed`
  const eventsByTopic = new Map<string, number>();
  for (const log of logs) {
    if (log.topics && log.topics[0]) {
      const count = eventsByTopic.get(log.topics[0]) || 0;
      eventsByTopic.set(log.topics[0], count + 1);
    }
  }

  console.log(`📈 Event signatures found:`);
  for (const [topic, count] of eventsByTopic) {
    const eventName = knownEvents[topic] || "Unknown";
    const isClaimedEvent = topic === claimedEventTopics[0];
    console.log(
      `  ${topic.slice(0, 10)}...: ${count} events - ${eventName} ${isClaimedEvent ? "✅" : ""}`,
    );
    if (!knownEvents[topic]) {
      console.log(`    Check: https://openchain.xyz/signatures?query=${topic}`);
    }
  }
  console.log("");

  // Filter only the Claimed events
  const claimedLogs = logs.filter(
    (log) => log.topics && log.topics[0] === claimedEventTopics[0],
  );

  console.log(`📊 Found ${claimedLogs.length} Claimed events specifically\n`);

  if (claimedLogs.length === 0) {
    console.log(
      `${colors.yellow}⚠️  No Claimed events found in this block range.${colors.reset}`,
    );
    console.log(`Try scanning a different block range.`);
    return;
  }

  // Get all accounts from the database
  const dbAccounts = await db
    .select({ account: convictionClaims.account })
    .from(convictionClaims)
    .execute();

  const accountSet = new Set(dbAccounts.map((a) => a.account.toLowerCase()));

  console.log(`📁 Database has ${accountSet.size} unique accounts\n`);

  // Process events and find missing ones
  const missingClaims = [];
  let totalEligibleAmount = 0n;
  let totalClaimedAmount = 0n;

  for (const log of claimedLogs) {
    if (!log.topics || log.topics.length < 2) continue;

    // Decode the account from topic1 (indexed parameter)
    const accountTopic = log.topics[1];
    if (!accountTopic) continue;

    // Convert topic to address (remove 0x prefix, take last 40 chars)
    const account = "0x" + accountTopic.slice(-40).toLowerCase();

    // Check if this account is in the database
    if (!accountSet.has(account)) {
      try {
        // Decode the full event data
        const decodedLog = decodeEventLog({
          abi: [claimedEventAbi],
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        }) as unknown as {
          args: {
            account: string;
            amount: bigint;
            claimedAmount: bigint;
            season: number;
          };
        };

        const claim = {
          account,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          amount: decodedLog.args.amount,
          claimedAmount: decodedLog.args.claimedAmount,
          season: decodedLog.args.season,
        };

        missingClaims.push(claim);
        totalEligibleAmount += BigInt(claim.amount);
        totalClaimedAmount += BigInt(claim.claimedAmount);
      } catch {
        console.log(`⚠️  Failed to decode event at block ${log.blockNumber}`);
      }
    }
  }

  // Display results
  if (missingClaims.length === 0) {
    console.log(
      `${colors.green}✅ No missing claims found in block range ${startBlock} to ${endBlock}!${colors.reset}`,
    );
    console.log(
      `\n💡 All Claimed events in this range are already indexed in the database.`,
    );
    return;
  }

  console.log(
    `${colors.yellow}⚠️  Found ${missingClaims.length} missing claim events!${colors.reset}\n`,
  );

  // Show the full list of missing claims
  for (const claim of missingClaims) {
    console.log(`${colors.red}Missing Claim:${colors.reset}`);
    console.log(`  Account: ${claim.account}`);
    console.log(`  Block: ${claim.blockNumber}`);
    console.log(`  Tx Hash: ${claim.transactionHash}`);
    console.log(`  Amount:         ${claim.amount}`);
    console.log(`  Claimed Amount: ${claim.claimedAmount}`);
    console.log(`  Season: ${claim.season}`);
    console.log();
  }

  // Analyze the transactions to understand why they're missing
  console.log(
    `${colors.blue}📈 Analyzing missing transactions...${colors.reset}\n`,
  );

  const missingTxHashes = new Set(missingClaims.map((c) => c.transactionHash));

  console.log("Missing Claim txn hashes:");
  for (const hash of missingTxHashes) {
    console.log(" - ", hash);
  }
  console.log("");

  console.log(`\n${colors.magenta}Summary:${colors.reset}`);
  console.log(`  Total missing claims: ${missingClaims.length}`);
  console.log(
    `  Total eligible amount: ${(Number(totalEligibleAmount) / 1e18).toFixed(2)} tokens`,
  );
  console.log(
    `  Total claimed amount: ${(Number(totalClaimedAmount) / 1e18).toFixed(2)} tokens`,
  );
  console.log(
    `  Average claim percentage: ${totalEligibleAmount > 0n ? ((Number(totalClaimedAmount) * 100) / Number(totalEligibleAmount)).toFixed(2) : 0}%`,
  );
  console.log("");

  // If --update flag is provided, insert missing claims into database
  if (shouldUpdate) {
    console.log(
      `\n${colors.cyan}📝 Inserting missing claims into database...${colors.reset}`,
    );

    try {
      // Get block timestamps for all unique blocks
      const uniqueBlocks = new Set(
        missingClaims
          .map((c) => c.blockNumber)
          .filter((b): b is number => b !== undefined),
      );
      const blockTimestamps = new Map<number, Date>();

      console.log(`  Fetching timestamps for ${uniqueBlocks.size} blocks...`);

      // Query block timestamps from hypersync
      for (const blockNum of uniqueBlocks) {
        const blockQuery: Query = {
          fromBlock: Number(blockNum),
          toBlock: Number(blockNum),
          fieldSelection: {
            block: [BlockField.Timestamp, BlockField.Number],
            log: [],
            transaction: [],
          },
        };

        const client = HypersyncClient.new({
          url: config.stakingIndex.hypersyncUrl!,
        });
        const blockRes = await client.get(blockQuery);

        if (blockRes.data?.blocks?.[0]) {
          const timestamp = blockRes.data.blocks[0].timestamp;
          if (timestamp !== undefined) {
            blockTimestamps.set(blockNum, new Date(Number(timestamp) * 1000));
          }
        }
      }

      // Prepare records for insertion
      const recordsToInsert = missingClaims.map((claim) => {
        const blockTimestamp =
          blockTimestamps.get(claim.blockNumber ?? 0) || new Date();

        return {
          account: claim.account.toLowerCase(),
          eligibleAmount: claim.amount,
          claimedAmount: claim.claimedAmount,
          season: claim.season,
          duration: calculateDurationFromClaim(
            claim.amount,
            claim.claimedAmount,
          ),
          blockNumber: BigInt(claim.blockNumber ?? 0),
          blockTimestamp: blockTimestamp,
          transactionHash: Buffer.from(
            (claim.transactionHash ?? "0x").slice(2),
            "hex",
          ),
          status: "success", // All these are successful since they emitted events
          gasUsed: null,
          gasPrice: null,
        };
      });

      // Insert into database
      const inserted = await db
        .insert(convictionClaims)
        .values(recordsToInsert)
        .onConflictDoNothing() // Skip if already exists
        .returning({ id: convictionClaims.id })
        .execute();

      console.log(
        `${colors.green}✅ Successfully inserted ${inserted.length} missing claims!${colors.reset}`,
      );

      if (inserted.length < missingClaims.length) {
        console.log(
          `${colors.yellow}⚠️  ${missingClaims.length - inserted.length} claims were skipped (likely duplicates)${colors.reset}`,
        );
      }
    } catch (error) {
      console.error(
        `${colors.red}❌ Error inserting claims into database:${colors.reset}`,
        error,
      );
      process.exit(1);
    }
  }

  process.exit(0);
}

// Run the script
findMissingClaims().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
