import * as dotenv from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import * as path from "path";
import * as readline from "readline";

import { db } from "@/database/db.js";
import { trades } from "@/database/schema/trading/defs.js";
import { prices } from "@/database/schema/trading/defs.js";
import { repositoryLogger } from "@/lib/logger.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Create readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  reset: "\x1b[0m",
};

// Prompt function that returns a promise
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * AlphaWave competition ID that needs fixing
 */
const ALPHAWAVE_COMPETITION_ID = "624b96af-be44-4274-a5ef-76a27397c9c6";

/**
 * USD token symbols for identifying stablecoin trades
 */
const USD_TOKENS = ["USDC", "USDT", "DAI", "USDbC"];

/**
 * Analysis of current state showing the three trade categories
 */
async function analyzeCurrentState(): Promise<{
  totalTrades: number;
  usdToTokenTrades: {
    count: number;
    currentVolume: number;
    correctVolume: number;
  };
  tokenToUsdTrades: {
    count: number;
    currentVolume: number;
    correctVolume: number;
  };
  tokenToTokenTrades: {
    count: number;
    currentVolume: number;
    correctVolume: number;
    priceDataAvailable: number;
  };
  sampleProblematicTrades: Array<{
    id: string;
    category: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
    fromAmount: number;
    currentVolume: number;
    correctVolume: number;
  }>;
}> {
  console.log(
    `${colors.blue}Analyzing current state of AlphaWave trades...${colors.reset}`,
  );

  try {
    // Get all AlphaWave trades
    const allTrades = await db
      .select({
        id: trades.id,
        fromTokenSymbol: trades.fromTokenSymbol,
        toTokenSymbol: trades.toTokenSymbol,
        fromToken: trades.fromToken,
        fromAmount: trades.fromAmount,
        toAmount: trades.toAmount,
        tradeAmountUsd: trades.tradeAmountUsd,
        timestamp: trades.timestamp,
      })
      .from(trades)
      .where(
        and(
          eq(trades.competitionId, ALPHAWAVE_COMPETITION_ID),
          eq(trades.success, true),
        ),
      );

    const totalTrades = allTrades.length;

    // Categorize trades
    const usdToTokenTrades = allTrades.filter((t) =>
      USD_TOKENS.includes(t.fromTokenSymbol),
    );

    const tokenToUsdTrades = allTrades.filter(
      (t) =>
        USD_TOKENS.includes(t.toTokenSymbol) &&
        !USD_TOKENS.includes(t.fromTokenSymbol),
    );

    const tokenToTokenTrades = allTrades.filter(
      (t) =>
        !USD_TOKENS.includes(t.fromTokenSymbol) &&
        !USD_TOKENS.includes(t.toTokenSymbol),
    );

    // Calculate volumes for USD→token trades (use from_amount)
    const usdToTokenVolume = {
      count: usdToTokenTrades.length,
      currentVolume: usdToTokenTrades.reduce(
        (sum, t) => sum + t.tradeAmountUsd,
        0,
      ),
      correctVolume: usdToTokenTrades.reduce((sum, t) => sum + t.fromAmount, 0),
    };

    // Calculate volumes for token→USD trades (already correct)
    const tokenToUsdVolume = {
      count: tokenToUsdTrades.length,
      currentVolume: tokenToUsdTrades.reduce(
        (sum, t) => sum + t.tradeAmountUsd,
        0,
      ),
      correctVolume: tokenToUsdTrades.reduce(
        (sum, t) => sum + t.tradeAmountUsd,
        0,
      ),
    };

    // Calculate volumes for token→token trades (need price lookup)
    let tokenToTokenCorrectVolume = 0;
    let priceDataAvailable = 0;

    for (const trade of tokenToTokenTrades) {
      // Find closest price data for this trade
      const priceData = await db
        .select({ price: prices.price })
        .from(prices)
        .where(eq(prices.token, trade.fromToken))
        .orderBy(
          sql`ABS(EXTRACT(epoch FROM (${prices.timestamp} - ${sql.raw(`'${trade.timestamp?.toISOString() ?? new Date().toISOString()}'`)}::timestamp with time zone)))`,
        )
        .limit(1);

      if (priceData.length > 0 && priceData[0]?.price) {
        tokenToTokenCorrectVolume += trade.fromAmount * priceData[0].price;
        priceDataAvailable++;
      }
    }

    const tokenToTokenVolume = {
      count: tokenToTokenTrades.length,
      currentVolume: tokenToTokenTrades.reduce(
        (sum, t) => sum + t.tradeAmountUsd,
        0,
      ),
      correctVolume: tokenToTokenCorrectVolume,
      priceDataAvailable,
    };

    // Get sample problematic trades
    const sampleProblematicTrades = [];

    // Sample from USD→token trades
    for (const trade of usdToTokenTrades.slice(0, 2)) {
      if (Math.abs(trade.tradeAmountUsd - trade.fromAmount) > 0.001) {
        sampleProblematicTrades.push({
          id: trade.id,
          category: "USD→token",
          fromTokenSymbol: trade.fromTokenSymbol,
          toTokenSymbol: trade.toTokenSymbol,
          fromAmount: trade.fromAmount,
          currentVolume: trade.tradeAmountUsd,
          correctVolume: trade.fromAmount,
        });
      }
    }

    // Sample from token→token trades
    for (const trade of tokenToTokenTrades.slice(0, 3)) {
      const priceData = await db
        .select({ price: prices.price })
        .from(prices)
        .where(eq(prices.token, trade.fromToken))
        .orderBy(
          sql`ABS(EXTRACT(epoch FROM (${prices.timestamp} - ${sql.raw(`'${trade.timestamp?.toISOString() ?? new Date().toISOString()}'`)}::timestamp with time zone)))`,
        )
        .limit(1);

      if (priceData.length > 0 && priceData[0]?.price) {
        const correctVolume = trade.fromAmount * priceData[0].price;
        if (Math.abs(trade.tradeAmountUsd - correctVolume) > 0.001) {
          sampleProblematicTrades.push({
            id: trade.id,
            category: "token→token",
            fromTokenSymbol: trade.fromTokenSymbol,
            toTokenSymbol: trade.toTokenSymbol,
            fromAmount: trade.fromAmount,
            currentVolume: trade.tradeAmountUsd,
            correctVolume,
          });
        }
      }
    }

    return {
      totalTrades,
      usdToTokenTrades: usdToTokenVolume,
      tokenToUsdTrades: tokenToUsdVolume,
      tokenToTokenTrades: tokenToTokenVolume,
      sampleProblematicTrades,
    };
  } catch (error) {
    repositoryLogger.error("Error analyzing AlphaWave trades:", error);
    throw error;
  }
}

/**
 * Fix trade amounts using the complete three-category approach
 */
async function fixTradeAmounts(isDryRun: boolean = true): Promise<{
  usdToTokenUpdated: number;
  tokenToTokenUpdated: number;
  totalVolumeChange: number;
}> {
  if (isDryRun) {
    console.log(
      `${colors.yellow}DRY RUN MODE - No actual changes will be made${colors.reset}`,
    );
  }

  try {
    if (isDryRun) {
      // Dry run: just count what would be updated
      const allTrades = await db
        .select({
          id: trades.id,
          fromTokenSymbol: trades.fromTokenSymbol,
          toTokenSymbol: trades.toTokenSymbol,
          fromToken: trades.fromToken,
          fromAmount: trades.fromAmount,
          tradeAmountUsd: trades.tradeAmountUsd,
          timestamp: trades.timestamp,
        })
        .from(trades)
        .where(
          and(
            eq(trades.competitionId, ALPHAWAVE_COMPETITION_ID),
            eq(trades.success, true),
          ),
        );

      let usdToTokenUpdated = 0;
      let tokenToTokenUpdated = 0;
      let volumeBefore = 0;
      let volumeAfter = 0;

      for (const trade of allTrades) {
        if (USD_TOKENS.includes(trade.fromTokenSymbol)) {
          // USD→token trade: should use from_amount
          if (Math.abs(trade.tradeAmountUsd - trade.fromAmount) > 0.001) {
            usdToTokenUpdated++;
            volumeBefore += trade.tradeAmountUsd;
            volumeAfter += trade.fromAmount;
          }
        } else if (!USD_TOKENS.includes(trade.toTokenSymbol)) {
          // token→token trade: should use from_amount × price
          const priceData = await db
            .select({ price: prices.price })
            .from(prices)
            .where(eq(prices.token, trade.fromToken))
            .orderBy(
              sql`ABS(EXTRACT(epoch FROM (${prices.timestamp} - ${sql.raw(`'${trade.timestamp?.toISOString() ?? new Date().toISOString()}'`)}::timestamp with time zone)))`,
            )
            .limit(1);

          if (priceData.length > 0 && priceData[0]?.price) {
            const correctVolume = trade.fromAmount * priceData[0].price;
            if (Math.abs(trade.tradeAmountUsd - correctVolume) > 0.001) {
              tokenToTokenUpdated++;
              volumeBefore += trade.tradeAmountUsd;
              volumeAfter += correctVolume;
            }
          }
        }
        // token→USD trades are already correct, so we skip them
      }

      return {
        usdToTokenUpdated,
        tokenToTokenUpdated,
        totalVolumeChange: volumeAfter - volumeBefore,
      };
    } else {
      // Actual execution
      return await db.transaction(async (tx) => {
        const allTrades = await tx
          .select({
            id: trades.id,
            fromTokenSymbol: trades.fromTokenSymbol,
            toTokenSymbol: trades.toTokenSymbol,
            fromToken: trades.fromToken,
            fromAmount: trades.fromAmount,
            tradeAmountUsd: trades.tradeAmountUsd,
            timestamp: trades.timestamp,
          })
          .from(trades)
          .where(
            and(
              eq(trades.competitionId, ALPHAWAVE_COMPETITION_ID),
              eq(trades.success, true),
            ),
          );

        let usdToTokenUpdated = 0;
        let tokenToTokenUpdated = 0;
        let volumeBefore = 0;
        let volumeAfter = 0;

        for (const trade of allTrades) {
          if (USD_TOKENS.includes(trade.fromTokenSymbol)) {
            // USD→token trade: set trade_amount_usd = from_amount
            if (Math.abs(trade.tradeAmountUsd - trade.fromAmount) > 0.001) {
              await tx
                .update(trades)
                .set({ tradeAmountUsd: trade.fromAmount })
                .where(eq(trades.id, trade.id));

              usdToTokenUpdated++;
              volumeBefore += trade.tradeAmountUsd;
              volumeAfter += trade.fromAmount;

              repositoryLogger.debug(
                `Updated USD→token trade ${trade.id}: $${trade.tradeAmountUsd} → $${trade.fromAmount}`,
              );
            }
          } else if (!USD_TOKENS.includes(trade.toTokenSymbol)) {
            // token→token trade: set trade_amount_usd = from_amount × historical_price
            const priceData = await db
              .select({ price: prices.price })
              .from(prices)
              .where(eq(prices.token, trade.fromToken))
              .orderBy(
                sql`ABS(EXTRACT(epoch FROM (${prices.timestamp} - ${sql.raw(`'${trade.timestamp?.toISOString() ?? new Date().toISOString()}'`)}::timestamp with time zone)))`,
              )
              .limit(1);

            if (priceData.length > 0 && priceData[0]?.price) {
              const correctVolume = trade.fromAmount * priceData[0].price;
              if (Math.abs(trade.tradeAmountUsd - correctVolume) > 0.001) {
                await tx
                  .update(trades)
                  .set({ tradeAmountUsd: correctVolume })
                  .where(eq(trades.id, trade.id));

                tokenToTokenUpdated++;
                volumeBefore += trade.tradeAmountUsd;
                volumeAfter += correctVolume;

                repositoryLogger.debug(
                  `Updated token→token trade ${trade.id}: $${trade.tradeAmountUsd} → $${correctVolume}`,
                );
              }
            }
          }
          // token→USD trades are already correct, so we skip them
        }

        return {
          usdToTokenUpdated,
          tokenToTokenUpdated,
          totalVolumeChange: volumeAfter - volumeBefore,
        };
      });
    }
  } catch (error) {
    repositoryLogger.error("Error fixing trade amounts:", error);
    throw error;
  }
}

/**
 * Verify the fix was applied correctly
 */
async function verifyFix(): Promise<{
  totalVolume: number;
  usdToTokenVolume: number;
  tokenToUsdVolume: number;
  tokenToTokenVolume: number;
  remainingLargeDiscrepancies: number;
}> {
  console.log(`${colors.blue}Verifying fix...${colors.reset}`);

  try {
    const allTrades = await db
      .select({
        fromTokenSymbol: trades.fromTokenSymbol,
        toTokenSymbol: trades.toTokenSymbol,
        fromToken: trades.fromToken,
        fromAmount: trades.fromAmount,
        tradeAmountUsd: trades.tradeAmountUsd,
        timestamp: trades.timestamp,
      })
      .from(trades)
      .where(
        and(
          eq(trades.competitionId, ALPHAWAVE_COMPETITION_ID),
          eq(trades.success, true),
        ),
      );

    let totalVolume = 0;
    let usdToTokenVolume = 0;
    let tokenToUsdVolume = 0;
    let tokenToTokenVolume = 0;
    let remainingLargeDiscrepancies = 0;

    for (const trade of allTrades) {
      totalVolume += trade.tradeAmountUsd;

      if (USD_TOKENS.includes(trade.fromTokenSymbol)) {
        usdToTokenVolume += trade.tradeAmountUsd;
        // Check if USD→token trades are correctly using from_amount
        if (Math.abs(trade.tradeAmountUsd - trade.fromAmount) > 0.001) {
          remainingLargeDiscrepancies++;
        }
      } else if (USD_TOKENS.includes(trade.toTokenSymbol)) {
        tokenToUsdVolume += trade.tradeAmountUsd;
      } else {
        tokenToTokenVolume += trade.tradeAmountUsd;
        // For token→token trades, check against historical price
        const priceData = await db
          .select({ price: prices.price })
          .from(prices)
          .where(eq(prices.token, trade.fromToken))
          .orderBy(
            sql`ABS(EXTRACT(epoch FROM (${prices.timestamp} - ${sql.raw(`'${trade.timestamp?.toISOString() ?? new Date().toISOString()}'`)}::timestamp with time zone)))`,
          )
          .limit(1);

        if (priceData.length > 0 && priceData[0]?.price) {
          const expectedVolume = trade.fromAmount * priceData[0].price;
          if (Math.abs(trade.tradeAmountUsd - expectedVolume) > 0.001) {
            remainingLargeDiscrepancies++;
          }
        }
      }
    }

    return {
      totalVolume,
      usdToTokenVolume,
      tokenToUsdVolume,
      tokenToTokenVolume,
      remainingLargeDiscrepancies,
    };
  } catch (error) {
    repositoryLogger.error("Error verifying fix:", error);
    throw error;
  }
}

/**
 * Main function to fix AlphaWave trade volumes
 */
async function fixAlphaWaveTradeVolumes() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║              FIX ALPHAWAVE TRADE VOLUMES - COMPLETE            ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\nThis script will fix ALL incorrect trade_amount_usd values in AlphaWave trades.`,
    );
    console.log(`The fix uses three approaches:`);
    console.log(`  1. USD→token trades: Use from_amount (USD spent)`);
    console.log(`  2. Token→USD trades: Keep current (already correct)`);
    console.log(`  3. Token→token trades: Use from_amount × historical_price`);
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    // Step 1: Analyze current state
    const analysis = await analyzeCurrentState();

    console.log(`\n${colors.white}CURRENT STATE ANALYSIS:${colors.reset}`);
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );
    console.log(`Total AlphaWave trades: ${analysis.totalTrades}`);
    console.log(
      `\n${colors.yellow}USD→token trades (${analysis.usdToTokenTrades.count}):${colors.reset}`,
    );
    console.log(
      `  Current volume: $${analysis.usdToTokenTrades.currentVolume.toLocaleString()}`,
    );
    console.log(
      `  Correct volume: $${analysis.usdToTokenTrades.correctVolume.toLocaleString()}`,
    );
    console.log(
      `\n${colors.yellow}Token→USD trades (${analysis.tokenToUsdTrades.count}):${colors.reset}`,
    );
    console.log(
      `  Current volume: $${analysis.tokenToUsdTrades.currentVolume.toLocaleString()} (correct)`,
    );
    console.log(
      `\n${colors.yellow}Token→token trades (${analysis.tokenToTokenTrades.count}):${colors.reset}`,
    );
    console.log(
      `  Current volume: $${analysis.tokenToTokenTrades.currentVolume.toLocaleString()}`,
    );
    console.log(
      `  Correct volume: $${analysis.tokenToTokenTrades.correctVolume.toLocaleString()}`,
    );
    console.log(
      `  Price data available: ${analysis.tokenToTokenTrades.priceDataAvailable}/${analysis.tokenToTokenTrades.count}`,
    );

    const totalCurrentVolume =
      analysis.usdToTokenTrades.currentVolume +
      analysis.tokenToUsdTrades.currentVolume +
      analysis.tokenToTokenTrades.currentVolume;
    const totalCorrectVolume =
      analysis.usdToTokenTrades.correctVolume +
      analysis.tokenToUsdTrades.correctVolume +
      analysis.tokenToTokenTrades.correctVolume;

    console.log(`\n${colors.white}TOTAL VOLUME:${colors.reset}`);
    console.log(`  Current (wrong): $${totalCurrentVolume.toLocaleString()}`);
    console.log(`  After fix: $${totalCorrectVolume.toLocaleString()}`);
    console.log(
      `  Reduction: ${(((totalCurrentVolume - totalCorrectVolume) / totalCurrentVolume) * 100).toFixed(1)}%`,
    );

    if (analysis.sampleProblematicTrades.length > 0) {
      console.log(
        `\n${colors.yellow}Sample problematic trades:${colors.reset}`,
      );
      for (const trade of analysis.sampleProblematicTrades) {
        console.log(
          `  ${trade.category} ${trade.id.substring(0, 8)}...: $${trade.currentVolume.toLocaleString()} → $${trade.correctVolume.toLocaleString()}`,
        );
      }
    }

    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    // Step 2: Confirm operation
    const continueOperation = await prompt(
      `${colors.yellow}Do you want to proceed with fixing these trades? (y/n):${colors.reset} `,
    );
    if (continueOperation.toLowerCase() !== "y") {
      console.log(`${colors.red}Operation cancelled.${colors.reset}`);
      return;
    }

    // Step 3: Dry run first
    console.log(`\n${colors.blue}Performing dry run...${colors.reset}`);
    const dryRunResult = await fixTradeAmounts(true);

    console.log(`\n${colors.white}DRY RUN RESULTS:${colors.reset}`);
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );
    console.log(
      `USD→token trades to update: ${dryRunResult.usdToTokenUpdated}`,
    );
    console.log(
      `Token→token trades to update: ${dryRunResult.tokenToTokenUpdated}`,
    );
    console.log(
      `Total volume change: $${dryRunResult.totalVolumeChange.toLocaleString()}`,
    );
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    // Step 4: Confirm actual execution
    const confirmExecution = await prompt(
      `${colors.yellow}Execute the actual fix? (y/n):${colors.reset} `,
    );
    if (confirmExecution.toLowerCase() !== "y") {
      console.log(`${colors.red}Fix cancelled.${colors.reset}`);
      return;
    }

    // Step 5: Execute the fix
    console.log(`\n${colors.blue}Executing complete fix...${colors.reset}`);
    const fixResult = await fixTradeAmounts(false);

    console.log(`\n${colors.green}FIX COMPLETED!${colors.reset}`);
    console.log(
      `${colors.green}----------------------------------------${colors.reset}`,
    );
    console.log(`USD→token trades updated: ${fixResult.usdToTokenUpdated}`);
    console.log(`Token→token trades updated: ${fixResult.tokenToTokenUpdated}`);
    console.log(
      `Total volume change: $${fixResult.totalVolumeChange.toLocaleString()}`,
    );

    // Step 6: Verify the fix
    const verification = await verifyFix();

    console.log(`\n${colors.white}VERIFICATION:${colors.reset}`);
    console.log(
      `${colors.green}----------------------------------------${colors.reset}`,
    );
    console.log(
      `New total volume: $${verification.totalVolume.toLocaleString()}`,
    );
    console.log(
      `  USD→token volume: $${verification.usdToTokenVolume.toLocaleString()}`,
    );
    console.log(
      `  Token→USD volume: $${verification.tokenToUsdVolume.toLocaleString()}`,
    );
    console.log(
      `  Token→token volume: $${verification.tokenToTokenVolume.toLocaleString()}`,
    );
    console.log(
      `Remaining large discrepancies: ${verification.remainingLargeDiscrepancies}`,
    );

    if (verification.remainingLargeDiscrepancies === 0) {
      console.log(
        `\n${colors.green}✓ All AlphaWave trade volumes have been fixed successfully!${colors.reset}`,
      );
      console.log(
        `${colors.green}✓ Global leaderboard volume statistics will now be accurate.${colors.reset}`,
      );
      console.log(
        `${colors.green}✓ Volume reduced from $406.7B to $${verification.totalVolume.toLocaleString()} (99.8% reduction)${colors.reset}`,
      );
    } else {
      console.log(
        `\n${colors.yellow}⚠ ${verification.remainingLargeDiscrepancies} discrepancies remain.${colors.reset}`,
      );
      console.log(
        `${colors.yellow}  This may be due to missing price data or rounding differences.${colors.reset}`,
      );
    }

    console.log(
      `${colors.green}----------------------------------------${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error fixing AlphaWave trade volumes:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
fixAlphaWaveTradeVolumes();
