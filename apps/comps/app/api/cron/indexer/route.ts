import { NextRequest } from "next/server";

import { IndexingService } from "@recallnet/services/indexing";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("StakingIndexer");

export const POST = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("begin");
  try {
  } finally {
    logger.info(`end, duration: ${Date.now() - startTime}ms`);
  }
});
