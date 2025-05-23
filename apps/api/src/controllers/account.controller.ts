import { NextFunction, Request, Response } from "express";

import {
  findActive,
  getPortfolioTokenValues,
  getTeamPortfolioSnapshots,
} from "@/database/repositories/competition-repository.js";
import { getLatestPrice } from "@/database/repositories/price-repository.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { SpecificChain } from "@/types/index.js";

export function makeAccountController(services: ServiceRegistry) {
  /**
   * Account Controller
   * Handles account-related operations
   */
  return {
    /** Gets the profile for the account
     *
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;

        // Get the team using the service
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          throw new ApiError(404, "Team not found");
        }

        // Return the team profile
        res.status(200).json({
          success: true,
          team: {
            id: team.id,
            name: team.name,
            email: team.email,
            contactPerson: team.contactPerson,
            metadata: team.metadata,
            imageUrl: team.imageUrl,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update profile for the authenticated team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updateProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;
        const { contactPerson, metadata, imageUrl } = req.body;

        // Get the team using the service
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          throw new ApiError(404, "Team not found");
        }

        // Update contact person
        if (contactPerson !== undefined) {
          team.contactPerson = contactPerson;
        }

        // Update metadata if provided
        if (metadata !== undefined) {
          team.metadata = metadata;
        }

        // Update imageUrl if provided
        if (imageUrl !== undefined) {
          team.imageUrl = imageUrl;
        }

        // Use the TeamManager service instead of directly updating the repository
        const updatedTeam = await services.teamManager.updateTeam(team);

        if (!updatedTeam) {
          throw new ApiError(500, "Failed to update team profile");
        }

        // Return the updated team profile
        res.status(200).json({
          success: true,
          team: {
            id: updatedTeam.id,
            name: updatedTeam.name,
            email: updatedTeam.email,
            contactPerson: updatedTeam.contactPerson,
            metadata: updatedTeam.metadata,
            imageUrl: updatedTeam.imageUrl,
            createdAt: updatedTeam.createdAt,
            updatedAt: updatedTeam.updatedAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get balances for the authenticated team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getBalances(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;

        // Get the balances
        const balances = await services.balanceManager.getAllBalances(teamId);

        // Enhance balances with chain information
        const enhancedBalances = await Promise.all(
          balances.map(async (balance) => {
            // First check if we have chain information in our database
            const latestPriceRecord = await getLatestPrice(
              balance.tokenAddress,
              balance.specificChain as SpecificChain,
            );

            // If we have complete chain info in our database, use that
            if (latestPriceRecord && latestPriceRecord.chain) {
              // For SVM tokens, specificChain is always 'svm'
              if (latestPriceRecord.chain === "svm") {
                return {
                  ...balance,
                  chain: latestPriceRecord.chain,
                  specificChain: "svm",
                  symbol: latestPriceRecord.symbol || balance.symbol,
                };
              }

              // For EVM tokens, if we have a specificChain, use it
              if (
                latestPriceRecord.chain === "evm" &&
                latestPriceRecord.specificChain
              ) {
                return {
                  ...balance,
                  chain: latestPriceRecord.chain,
                  specificChain: latestPriceRecord.specificChain,
                  symbol: latestPriceRecord.symbol || balance.symbol,
                };
              }
            }

            // If we don't have complete chain info, use getTokenInfo (which will update our database)
            const tokenInfo = await services.priceTracker.getTokenInfo(
              balance.tokenAddress,
            );

            if (tokenInfo) {
              return {
                ...balance,
                chain: tokenInfo.chain,
                specificChain: tokenInfo.specificChain,
                symbol: tokenInfo.symbol || balance.symbol,
              };
            }

            // As a last resort, determine chain type locally
            const chain = services.priceTracker.determineChain(
              balance.tokenAddress,
            );
            const specificChain = chain === "svm" ? "svm" : null;

            return {
              ...balance,
              chain,
              specificChain,
              symbol: balance.symbol, // Use the symbol from the database
            };
          }),
        );

        // Return the balances
        res.status(200).json({
          success: true,
          teamId,
          balances: enhancedBalances,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get portfolio information for the authenticated team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getPortfolio(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;

        // First, check if there's an active competition
        const activeCompetition = await findActive();

        // Check if we have snapshot data (preferred method)
        if (activeCompetition) {
          // Try to get the latest snapshot for this team
          const teamSnapshots = await getTeamPortfolioSnapshots(
            activeCompetition.id,
            teamId,
          );

          // If we have a snapshot, use it
          if (teamSnapshots.length > 0) {
            // Get the most recent snapshot
            const latestSnapshot = teamSnapshots[teamSnapshots.length - 1]!;

            // Get the token values for this snapshot
            const tokenValues = await getPortfolioTokenValues(
              latestSnapshot.id,
            );

            // Format the token values with additional information
            const formattedTokens = tokenValues.map((tokenValue) => {
              // Use the price from the snapshot and only determine chain type
              const chain = services.priceTracker.determineChain(
                tokenValue.tokenAddress,
              );

              // For SVM tokens, the specificChain is always 'svm'
              // For EVM tokens, we don't have specificChain without an API call, so we'll leave it undefined
              const specificChain = chain === "svm" ? "svm" : undefined;

              return {
                token: tokenValue.tokenAddress,
                amount: tokenValue.amount,
                price: tokenValue.price,
                value: tokenValue.valueUsd,
                chain,
                specificChain,
                symbol: tokenValue.symbol, // Use symbol from the snapshot/database
              };
            });

            // Return the snapshot information
            return res.status(200).json({
              success: true,
              teamId,
              totalValue: latestSnapshot.totalValue,
              tokens: formattedTokens,
              snapshotTime: latestSnapshot.timestamp,
              source: "snapshot", // Indicate this is from a snapshot
            });
          }

          // No snapshot, but we should initiate one for future requests
          console.log(
            `[AccountController] No portfolio snapshots found for team ${teamId} in competition ${activeCompetition.id}`,
          );
          // Request a snapshot asynchronously (don't await)
          services.portfolioSnapshotter
            .takePortfolioSnapshots(activeCompetition.id)
            .catch((error) => {
              console.error(
                `[AccountController] Error taking snapshot for team ${teamId}:`,
                error,
              );
            });
        }

        // Fall back to calculating portfolio on-demand
        console.log(
          `[AccountController] Using live calculation for portfolio of team ${teamId}`,
        );

        // Get the balances
        const balances = await services.balanceManager.getAllBalances(teamId);
        let totalValue = 0;
        const tokenValues = [];

        // Calculate values with minimal API calls
        for (const balance of balances) {
          // Get price and token information using the existing service method
          const tokenInfo = await services.priceTracker.getTokenInfo(
            balance.tokenAddress,
          );
          const price = tokenInfo?.price || 0;
          const value = price ? balance.amount * price : 0;
          totalValue += value;

          tokenValues.push({
            token: balance.tokenAddress,
            amount: balance.amount,
            price: price,
            value,
            chain: tokenInfo?.chain,
            specificChain: tokenInfo?.specificChain,
            symbol: tokenInfo?.symbol || balance.symbol,
          });
        }

        // Return the calculated portfolio information
        return res.status(200).json({
          success: true,
          teamId,
          totalValue,
          tokens: tokenValues,
          source: "live-calculation", // Indicate this is a live calculation
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getTrades(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;

        // Get the trades
        const trades = await services.tradeSimulator.getTeamTrades(teamId);

        // Sort trades by timestamp (newest first)
        const sortedTrades = [...trades].sort(
          (a, b) =>
            (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0),
        );

        // Return the trades
        res.status(200).json({
          success: true,
          teamId,
          trades: sortedTrades,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reset the API key for the authenticated team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async resetApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const teamId = req.teamId as string;

        // Use the TeamManager service to reset the API key
        const result = await services.teamManager.resetApiKey(teamId);

        // Return the new API key
        res.status(200).json({
          success: true,
          apiKey: result.apiKey,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type AccountController = ReturnType<typeof makeAccountController>;
