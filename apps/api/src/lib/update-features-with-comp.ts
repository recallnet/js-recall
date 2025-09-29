import { SelectCompetition } from "@recallnet/db/schema/core/types";
import { Competition, CrossChainTradingType } from "@recallnet/services/types";

import { features } from "@/config/index.js";
import { logger } from "@/lib/logger.js";

export function updateFeaturesWithCompetition(activeCompetition?: {
  id: string;
  crossChainTradingType: CrossChainTradingType;
  sandboxMode: boolean;
}) {
  if (activeCompetition) {
    // Override the environment-based settings with competition-specific settings
    features.CROSS_CHAIN_TRADING_TYPE = activeCompetition.crossChainTradingType;
    features.SANDBOX_MODE = activeCompetition.sandboxMode;

    logger.debug(
      `Updated competition settings from competition ${activeCompetition.id}:`,
      {
        crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
        sandboxMode: features.SANDBOX_MODE,
      },
    );
  } else {
    // No active competition, keep the environment variable settings
    features.SANDBOX_MODE = false; // Default to false when no active competition
    logger.debug(`No active competition, using environment settings:`, {
      crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
      sandboxMode: features.SANDBOX_MODE,
    });
  }
}
