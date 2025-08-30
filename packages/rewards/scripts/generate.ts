#!/usr/bin/env node
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration interface for data generation
 */
interface GenerationConfig {
  numCompetitors: number;
  numUsers: number;
  prizePool: string;
  windowStart: string;
  windowEnd: string;
  minBoostsPerUser: number;
  maxBoostsPerUser: number;
  minBoostValue: number;
  maxBoostValue: number;
  outputFile: string;
}

/**
 * Interface for the generated data structure
 */
interface GeneratedData {
  prizePool: string;
  leaderBoard: string[];
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
  config?: {
    includeCalculationSteps?: boolean;
    validateBounds?: boolean;
    validateDistributionCompleteness?: boolean;
  };
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random timestamp within the given window
 */
function randomTimestamp(start: Date, end: Date): string {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime).toISOString();
}

/**
 * Generate competitor names
 */
function generateCompetitors(numCompetitors: number): string[] {
  const competitors: string[] = [];
  for (let i = 1; i <= numCompetitors; i++) {
    competitors.push(`Competitor ${String.fromCharCode(64 + i)}`); // A, B, C, etc.
  }
  return competitors;
}

/**
 * Generate user names
 */
function generateUsers(numUsers: number): string[] {
  const adjectives = [
    "Swift",
    "Brave",
    "Clever",
    "Bright",
    "Calm",
    "Daring",
    "Eager",
    "Fierce",
    "Gentle",
    "Happy",
    "Intelligent",
    "Joyful",
    "Kind",
    "Lively",
    "Mighty",
    "Noble",
    "Optimistic",
    "Peaceful",
    "Quick",
    "Radiant",
    "Strong",
    "Tender",
    "Unique",
    "Vibrant",
    "Wise",
    "Young",
    "Zealous",
    "Ambitious",
    "Bold",
    "Creative",
    "Dynamic",
    "Energetic",
    "Friendly",
    "Generous",
    "Honest",
    "Innovative",
    "Jovial",
    "Knowledgeable",
    "Loyal",
    "Motivated",
    "Natural",
    "Open",
    "Patient",
    "Qualified",
    "Reliable",
    "Skilled",
    "Talented",
    "Understanding",
    "Versatile",
    "Warm",
    "Xenial",
    "Youthful",
    "Zesty",
  ];

  const nouns = [
    "Tiger",
    "Eagle",
    "Lion",
    "Wolf",
    "Bear",
    "Fox",
    "Hawk",
    "Dragon",
    "Phoenix",
    "Shark",
    "Panther",
    "Falcon",
    "Leopard",
    "Cobra",
    "Viper",
    "Python",
    "Jaguar",
    "Lynx",
    "Cheetah",
    "Grizzly",
    "Polar",
    "Kodiak",
    "Black",
    "Brown",
    "White",
    "Golden",
    "Silver",
    "Bronze",
    "Copper",
    "Iron",
    "Steel",
    "Crystal",
    "Diamond",
    "Ruby",
    "Emerald",
    "Sapphire",
    "Pearl",
    "Opal",
    "Jade",
    "Amber",
    "Topaz",
    "Garnet",
    "Quartz",
    "Marble",
    "Granite",
    "Obsidian",
    "Basalt",
    "Slate",
    "Limestone",
    "Sandstone",
    "Shale",
    "Gneiss",
    "Schist",
    "Quartzite",
  ];

  const users: string[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < numUsers; i++) {
    let userName: string;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    do {
      const adjective = adjectives[randomInt(0, adjectives.length - 1)];
      const noun = nouns[randomInt(0, nouns.length - 1)];
      const number = randomInt(1, 999);
      userName = `${adjective}${noun}${number}`;
      attempts++;
    } while (usedNames.has(userName) && attempts < maxAttempts);

    // If we can't generate a unique name after max attempts, add a timestamp
    if (usedNames.has(userName)) {
      const timestamp = Date.now().toString().slice(-6);
      userName = `${userName}_${timestamp}`;
    }

    usedNames.add(userName);
    users.push(userName);
  }

  return users;
}

/**
 * Generate boost allocations
 */
function generateBoostAllocations(
  users: string[],
  competitors: string[],
  windowStart: Date,
  windowEnd: Date,
  minBoostsPerUser: number,
  maxBoostsPerUser: number,
  minBoostValue: number,
  maxBoostValue: number,
): Array<{
  user: string;
  competitor: string;
  boost: number;
  timestamp: string;
}> {
  const allocations: Array<{
    user: string;
    competitor: string;
    boost: number;
    timestamp: string;
  }> = [];

  for (const user of users) {
    const numBoosts = randomInt(minBoostsPerUser, maxBoostsPerUser);

    for (let i = 0; i < numBoosts; i++) {
      const competitor = competitors[randomInt(0, competitors.length - 1)];
      const boost = randomInt(minBoostValue, maxBoostValue);
      const timestamp = randomTimestamp(windowStart, windowEnd);

      allocations.push({
        user,
        competitor,
        boost,
        timestamp,
      });
    }
  }

  // Sort by timestamp for consistency
  return allocations.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/**
 * Generate test data based on configuration
 */
function generateTestData(config: GenerationConfig): GeneratedData {
  const competitors = generateCompetitors(config.numCompetitors);
  const users = generateUsers(config.numUsers);
  const windowStart = new Date(config.windowStart);
  const windowEnd = new Date(config.windowEnd);

  const boostAllocations = generateBoostAllocations(
    users,
    competitors,
    windowStart,
    windowEnd,
    config.minBoostsPerUser,
    config.maxBoostsPerUser,
    config.minBoostValue,
    config.maxBoostValue,
  );

  return {
    prizePool: config.prizePool,
    leaderBoard: competitors,
    window: {
      start: config.windowStart,
      end: config.windowEnd,
    },
    boostAllocations,
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): GenerationConfig {
  const args = process.argv.slice(2);
  const config: Partial<GenerationConfig> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (!value) continue; // Skip if no value provided

    switch (key) {
      case "--competitors": {
        const competitors = parseInt(value);
        if (!isNaN(competitors)) config.numCompetitors = competitors;
        break;
      }
      case "--users": {
        const users = parseInt(value);
        if (!isNaN(users)) config.numUsers = users;
        break;
      }
      case "--prize-pool":
        if (value) config.prizePool = value;
        break;
      case "--window-start":
        if (value) config.windowStart = value;
        break;
      case "--window-end":
        if (value) config.windowEnd = value;
        break;
      case "--min-boosts": {
        const minBoosts = parseInt(value);
        if (!isNaN(minBoosts)) config.minBoostsPerUser = minBoosts;
        break;
      }
      case "--max-boosts": {
        const maxBoosts = parseInt(value);
        if (!isNaN(maxBoosts)) config.maxBoostsPerUser = maxBoosts;
        break;
      }
      case "--min-boost-value": {
        const minBoostValue = parseInt(value);
        if (!isNaN(minBoostValue)) config.minBoostValue = minBoostValue;
        break;
      }
      case "--max-boost-value": {
        const maxBoostValue = parseInt(value);
        if (!isNaN(maxBoostValue)) config.maxBoostValue = maxBoostValue;
        break;
      }
      case "--output":
        config.outputFile = value;
        break;
    }
  }

  // Set defaults
  return {
    numCompetitors: config.numCompetitors ?? 3,
    numUsers: config.numUsers ?? 5,
    prizePool: config.prizePool || "1000000000000000000000", // 1000 ETH in wei
    windowStart: config.windowStart || "2024-01-01T00:00:00Z",
    windowEnd: config.windowEnd || "2024-01-05T00:00:00Z",
    minBoostsPerUser: config.minBoostsPerUser ?? 1,
    maxBoostsPerUser: config.maxBoostsPerUser ?? 5,
    minBoostValue: config.minBoostValue ?? 10,
    maxBoostValue: config.maxBoostValue ?? 200,
    outputFile: config.outputFile || "generated-test-data.json",
  };
}

/**
 * Display usage information
 */
function showUsage(): void {
  console.log(`
Usage: tsx scripts/generate.ts [options]

Options:
  --competitors <number>     Number of competitors (default: 3)
  --users <number>          Number of users (default: 5)
  --prize-pool <string>     Prize pool amount in wei (default: 1000000000000000000000)
  --window-start <string>   Start time in ISO format (default: 2024-01-01T00:00:00Z)
  --window-end <string>     End time in ISO format (default: 2024-01-05T00:00:00Z)
  --min-boosts <number>     Minimum boosts per user (default: 1)
  --max-boosts <number>     Maximum boosts per user (default: 5)
  --min-boost-value <number> Minimum boost value (default: 10)
  --max-boost-value <number> Maximum boost value (default: 200)
  --output <filename>       Output file name (default: generated-test-data.json)

Examples:
  tsx scripts/generate.ts --competitors 5 --users 10 --output large-test.json
  tsx scripts/generate.ts --min-boosts 3 --max-boosts 8 --min-boost-value 50 --max-boost-value 300
`);
}

/**
 * Main generation script
 */
async function main() {
  try {
    // Check for help flag
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      showUsage();
      return;
    }

    console.log("Starting test data generation...\n");

    // Parse configuration
    const config = parseArgs();

    console.log("Configuration:");
    console.log(`   Competitors: ${config.numCompetitors}`);
    console.log(`   Users: ${config.numUsers}`);
    console.log(`   Prize Pool: ${config.prizePool} WEI`);
    console.log(`   Window: ${config.windowStart} to ${config.windowEnd}`);
    console.log(
      `   Boosts per user: ${config.minBoostsPerUser}-${config.maxBoostsPerUser}`,
    );
    console.log(
      `   Boost values: ${config.minBoostValue}-${config.maxBoostValue}`,
    );
    console.log(`   Output file: ${config.outputFile}`);
    console.log("");

    // Generate test data
    console.log("Generating test data...");
    const testData = generateTestData(config);

    // Write to file
    const outputPath = join(__dirname, "..", config.outputFile);
    writeFileSync(outputPath, JSON.stringify(testData, null, 2), "utf-8");

    console.log(`Test data generated successfully!`);
    console.log(
      `   Total boost allocations: ${testData.boostAllocations.length}`,
    );
    console.log(`   Output file: ${outputPath}`);
    console.log("");
    console.log("You can now use this file with the verify script:");
    console.log(`   tsx scripts/verify.ts ${config.outputFile}`);
  } catch (error) {
    console.error("Error during generation:", error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
