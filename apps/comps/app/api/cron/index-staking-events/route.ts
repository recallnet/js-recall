import { NextRequest } from "next/server";

import { config } from "@/config/private";
import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { getEventsIndexingService } from "@/lib/services";

const logger = createLogger("CronStakeEventsIndexer");

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
    await getEventsIndexingService().runOnce();
    return {
      success: true,
      duration: Date.now() - startTime,
      message: "Events indexer completed successfully",
    };
  } finally {
    logger.info(`end, duration: ${Date.now() - startTime}ms`);
  }
});
