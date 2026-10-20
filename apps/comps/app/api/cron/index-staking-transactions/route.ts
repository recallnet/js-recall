import { NextRequest } from "next/server";

import { config } from "@/config/private";
import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { getTransactionsIndexingService } from "@/lib/services";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const logger = createLogger("CronStakeTransactionsIndexer");

export const GET = withCronAuth(async (_: NextRequest) => {
  if (!config.stakeIndexingEnabled) {
    logger.info("Stake indexing is disabled");
    return {
      success: false,
      status: "disabled",
      ran: false,
      message: "Stake indexing is disabled",
    };
  }

  const startTime = Date.now();
  logger.info("begin");
  try {
    const result = await getTransactionsIndexingService().runOnce();
    return {
      success: true,
      ...result,
      ran: result.batches > 0,
      duration: Date.now() - startTime,
      message: "Transaction indexer pass finished",
    };
  } finally {
    logger.info(`end, duration: ${Date.now() - startTime}ms`);
  }
});
