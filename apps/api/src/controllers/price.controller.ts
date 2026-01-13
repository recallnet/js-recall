import { NextFunction, Request, Response } from "express";

import {
  ApiError,
  BlockchainType,
  SpecificChain,
} from "@recallnet/services/types";

import { priceLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

export function makePriceController(services: ServiceRegistry) {
  /**
   * Price Controller
   * Handles price-related operations
   */
  return {
    /**
     * Get price for a token
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getPrice(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;
        const {
          token,
          chain: requestedChain,
          specificChain: requestedSpecificChain,
        } = req.query;

        if (!token || typeof token !== "string") {
          throw new ApiError(400, "Token address is required");
        }

        priceLogger.debug(
          `Getting price for token ${token} requested by agent ${agentId}`,
        );

        // Determine the blockchain type for this token, using the requested chain if provided
        let blockchainType: BlockchainType;
        if (requestedChain === "evm") {
          blockchainType = BlockchainType.EVM;
        } else if (requestedChain === "svm") {
          blockchainType = BlockchainType.SVM;
        } else {
          blockchainType = services.priceTrackerService.determineChain(token);
        }

        // Determine specific chain if provided
        let specificChain: SpecificChain | undefined = undefined;
        if (
          typeof requestedSpecificChain === "string" &&
          [
            "eth",
            "polygon",
            "arbitrum",
            "optimism",
            "avalanche",
            "base",
            "linea",
            "zksync",
            "scroll",
            "mantle",
            "svm",
          ].includes(requestedSpecificChain)
        ) {
          specificChain = requestedSpecificChain as SpecificChain;
        }

        // Get the price from price tracker
        // Pass both blockchainType and specificChain to getPrice
        const price = await services.priceTrackerService.getPrice(
          token,
          blockchainType,
          specificChain,
        );

        res.status(200).json({
          success: price !== null,
          ...price,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type PriceController = ReturnType<typeof makePriceController>;
