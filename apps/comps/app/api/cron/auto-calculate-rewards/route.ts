import ejs from "ejs";
import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import * as path from "path";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { config } from "@/config/private";
import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";
import { rewardsService } from "@/lib/services";

const logger = createLogger("CronAutoCalculateRewards");

/**
 * Cron handler wrapped with authentication
 */
export const POST = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("Starting auto calculate rewards task...");

  try {
    // Process competition end date checks
    logger.info("Processing pending rewards competitions...");
    const competitionId =
      await competitionService.processPendingRewardsCompetitions();
    if (!competitionId) {
      logger.info("No competition needing rewards calculation found");
      return {
        success: true,
        duration: Date.now() - startTime,
        message: "No competition needing rewards calculation found",
      };
    }

    logger.info(
      `Generating and sending report for competition ${competitionId}`,
    );
    await generateAndSendReport(competitionId);

    const duration = Date.now() - startTime;
    logger.info(
      `Auto calculate rewards completed successfully in ${duration}ms!`,
    );

    return {
      success: true,
      duration,
      competitionId,
      message: "Auto calculate rewards completed successfully",
    };
  } catch (error) {
    logger.error({ error }, "Error processing pending rewards competitions:");

    throw error;
  }
});

/**
 * Convert a bigint amount with 18 decimals to a number string (no formatting)
 */
function formatTokenAmount(amount: bigint): string {
  return attoValueToNumberValue(amount, "ROUND_DOWN", 3).toString();
}

const COMMIT_HASH = process.env.VERCEL_GIT_COMMIT_SHA || "unknown";

function formatBigIntWith18Decimals(value: bigint): string {
  const s = value.toString().padStart(19, "0"); // ensure at least 19 digits
  const intPart = s.slice(0, -18) || "0";
  const fracPart = s.slice(-18);
  return `${intPart}.${fracPart}`.replace(/\.?0+$/, ""); // remove trailing zeros
}

/**
 * Generate and send Slack report for a competition
 */
async function generateAndSendReport(competitionId: string): Promise<void> {
  try {
    const reportData = await rewardsService.getRewardsReportData(competitionId);

    // Format amounts for display
    const formatAmount = (amount: bigint) => formatTokenAmount(amount);
    // Format top agents and boosters
    const top5Agents = reportData.top5Agents.map(
      (agent: { address: string; amount: bigint }) => ({
        address: agent.address,
        amountFormatted: formatAmount(agent.amount),
      }),
    );

    const top5Boosters = reportData.top5Boosters.map(
      (booster: { address: string; amount: bigint }) => ({
        address: booster.address,
        amountFormatted: formatAmount(booster.amount),
      }),
    );

    // Format booster stats
    const boosterStats = {
      averageFormatted: formatAmount(reportData.boosterStats.average),
      medianFormatted: formatAmount(reportData.boosterStats.median),
      largestFormatted: formatAmount(reportData.boosterStats.largest),
      smallestFormatted: formatBigIntWith18Decimals(
        reportData.boosterStats.smallest,
      ),
      largestAddress: reportData.boosterStats.largestAddress,
      smallestAddress: reportData.boosterStats.smallestAddress,
    };

    // Get contract addresses
    const tokenContractAddress = config.rewards.tokenContractAddress
      ? config.rewards.tokenContractAddress
      : "N/A";
    const rewardsContractAddress = config.rewards.contractAddress
      ? config.rewards.contractAddress
      : "N/A";

    // Get the original (unformatted) top competitor from reportData
    const originalTopAgents = [...reportData.agentRewards]
      .sort((a, b) => {
        if (a.amount < b.amount) return 1;
        if (a.amount > b.amount) return -1;
        return 0;
      })
      .slice(0, 1);

    const topCompetitor = originalTopAgents[0];
    if (!topCompetitor) {
      throw new Error("No top competitor found");
    }
    const proof = await rewardsService.retrieveProof(
      competitionId,
      topCompetitor.address as `0x${string}`,
      topCompetitor.amount,
    );
    const proofHex = proof
      .map((p) => `0x${Buffer.from(p).toString("hex")}`)
      .join(",");

    const verificationExample = {
      address: topCompetitor.address,
      amount: formatAmount(topCompetitor.amount),
      proof: proofHex,
    };

    // Generate timestamp
    const generatedDate =
      new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

    // Load and render template
    const templatePath = path.resolve(
      process.cwd(),
      "templates/rewards-report.ejs",
    );
    const template = readFileSync(templatePath, "utf-8");
    const message = ejs.render(template, {
      competitionName: reportData.competition.name,
      merkleRoot: reportData.merkleRoot,
      generatedDate,
      commitHash: COMMIT_HASH,
      tokenContractAddress,
      rewardsContractAddress,
      totalRecipients: reportData.totalRecipients,
      totalBoosters: reportData.totalBoosters,
      totalAgents: reportData.totalAgents,
      totalRewards: reportData.totalRewards,
      top5Agents,
      top5Boosters,
      boosterStats,
      verificationExample,
    });

    // Send to Slack if webhook URL is configured
    const slackWebhookUrl = config.rewards.slackWebhookUrl;
    if (slackWebhookUrl) {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: message,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to send Slack message: ${response.status} ${response.statusText}`,
        );
      }

      logger.info(
        `Successfully sent rewards report to Slack for competition ${competitionId}`,
      );
    } else {
      logger.warn(
        "REWARDS_SLACK_WEBHOOK_URL not configured, skipping Slack notification",
      );
      logger.info(
        `Rewards report for competition ${competitionId}:\n${message}`,
      );
    }
  } catch (error) {
    logger.error(
      { error },
      `Error generating report for competition ${competitionId}`,
    );
    // Don't throw - we don't want to fail the entire process if report generation fails
  }
}
