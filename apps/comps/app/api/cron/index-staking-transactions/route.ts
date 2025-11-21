import { NextRequest } from "next/server";

import { config } from "@/config/private";
import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { getTransactionsIndexingService } from "@/lib/services";

const logger = createLogger("CronStakeTransactionsIndexer");

export const GET = withCronAuth(async (_: NextRequest) => {
  if (!config.stakeIndexingEnabled) {
    logger.info("Stake indexing is disabled");
    return {
      success: true,
      message: "Stake indexing is disabled",
    };
  }

  const startTime = Date.now();
  logger.info("begin");
  try {
    await getTransactionsIndexingService().runOnce();
    return {
      success: true,
      duration: Date.now() - startTime,
      message: "Transaction indexer completed successfully",
    };
  } finally {
    logger.info(`end, duration: ${Date.now() - startTime}ms`);
  }
});
