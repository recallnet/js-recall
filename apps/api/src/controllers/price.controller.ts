import { NextFunction, Request, Response } from "express";

import { priceLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

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
          blockchainType = services.priceTracker.determineChain(token);
        }

        // Determine specific chain if provided
        let specificChain: SpecificChain | undefined = undefined;
        if (
          typeof requestedSpecificChain === "string" &&
          [
            "eth",
            "polygon",
            "bsc",
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

        // For EVM tokens, try to get more detailed chain information
        if (blockchainType === BlockchainType.EVM) {
          // Pass both blockchainType and specificChain to getTokenInfo
          const tokenInfo = await services.priceTracker.getTokenInfo(
            token,
            blockchainType,
            specificChain,
          );

          if (tokenInfo) {
            // Return with specific EVM chain (eth, polygon, base, etc.)
            return res.status(200).json({
              success: tokenInfo.price !== null,
              ...tokenInfo,
            });
          }
        }

        // Get the price from price tracker for non-EVM tokens or if getTokenInfo failed
        // Pass both blockchainType and specificChain to getPrice
        const price = await services.priceTracker.getPrice(
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

    /**
     * Get detailed token information including specific chain (for EVM tokens)
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getTokenInfo(req: Request, res: Response, next: NextFunction) {
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
          `Getting token info for ${token} requested by agent ${agentId}`,
        );

        // Determine blockchain type using the requested chain if provided
        let blockchainType: BlockchainType;
        if (requestedChain === "evm") {
          blockchainType = BlockchainType.EVM;
        } else if (requestedChain === "svm") {
          blockchainType = BlockchainType.SVM;
        } else {
          blockchainType = services.priceTracker.determineChain(token);
        }

        // Determine specific chain if provided
        let specificChain: SpecificChain | undefined = undefined;
        if (
          typeof requestedSpecificChain === "string" &&
          [
            "eth",
            "polygon",
            "bsc",
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

        // Get detailed token info (for both EVM and SVM tokens)
        // Pass both blockchainType and specificChain to getTokenInfo
        const tokenInfo = await services.priceTracker.getTokenInfo(
          token,
          blockchainType,
          specificChain,
        );

        if (!tokenInfo) {
          return res.status(200).json({
            success: false,
            price: null,
            token,
            chain: blockchainType,
            specificChain: null,
          });
        }

        res.status(200).json({
          success: tokenInfo.price !== null,
          price: tokenInfo.price,
          token,
          chain: blockchainType,
          specificChain: tokenInfo.specificChain,
          symbol: tokenInfo.symbol,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type PriceController = ReturnType<typeof makePriceController>;
