import { NextFunction, Request, Response } from "express";

import {
  findActive,
  getAgentPortfolioSnapshots,
  getPortfolioTokenValues,
} from "@/database/repositories/competition-repository.js";
import { getLatestPrice } from "@/database/repositories/price-repository.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AgentFilterSchema,
  AuthenticatedRequest,
  PagingParamsSchema,
  SpecificChain,
  UpdateAgentProfileSchema,
  UuidSchema,
} from "@/types/index.js";

import {
  ensureAgentCompetitionFilters,
  ensurePaging,
  ensureUuid,
} from "./request-helpers.js";

/**
 * Agent Controller
 * Handles agent-specific trading operations with agent API key authentication
 * Sets req.agentId from agent API key validation
 */
export function makeAgentController(services: ServiceRegistry) {
  return {
    /**
     * Get profile for the authenticated agent and its owner
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Get the agent using the service
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Get the owner user information
        const owner = await services.userManager.getUser(agent.ownerId);

        if (!owner) {
          throw new ApiError(404, "Agent owner not found");
        }

        // Return the agent profile with owner information
        // TODO: we can clean this up with better types that help omit the api key
        res.status(200).json({
          success: true,
          agent: services.agentManager.sanitizeAgent(agent),
          owner: {
            id: owner.id,
            walletAddress: owner.walletAddress,
            name: owner.name,
            email: owner.email,
            imageUrl: owner.imageUrl,
            metadata: owner.metadata,
            status: owner.status,
            createdAt: owner.createdAt,
            updatedAt: owner.updatedAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update profile for the authenticated agent
     * Limited to description and imageUrl only (agent self-service)
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async updateProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = UpdateAgentProfileSchema.safeParse({
          agentId: req.agentId,
          body: req.body,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const {
          agentId,
          body: { description, imageUrl },
        } = data;

        // Get the current agent
        const agent = await services.agentManager.getAgent(agentId);
        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Prepare update data with only allowed fields
        const updateData = {
          id: agentId,
          description,
          imageUrl,
        };

        const updatedAgent = await services.agentManager.updateAgent({
          ...agent,
          ...updateData,
        });

        if (!updatedAgent) {
          throw new ApiError(500, "Failed to update agent profile");
        }

        res.status(200).json({
          success: true,
          agent: services.agentManager.sanitizeAgent(updatedAgent),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get agents with sorting, filtering, and pagination
     * @param req Express request with querystring containing filter, sort, and paging
     * @param res Express response
     * @param next Express next function
     */
    async getAgents(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const pagingParams = PagingParamsSchema.parse(req.query);
        const filter = req.query.filter
          ? AgentFilterSchema.parse(req.query.filter)
          : undefined;
        const agents = await services.agentManager.getAgents({
          filter,
          pagingParams,
        });
        const totalCount = await services.agentManager.countAgents(filter);
        const { limit, offset } = pagingParams;

        // Return the agents
        res.status(200).json({
          success: true,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: limit + offset < totalCount,
          },
          agents: agents.map(
            services.agentManager.sanitizeAgent.bind(services.agentManager),
          ),
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get an agent with the given agent id
     * @param req Express request with agent id in url path
     * @param res Express response
     * @param next Express next function
     */
    async getAgent(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { success, data: agentId } = UuidSchema.safeParse(
          req.params.agentId,
        );
        if (!success) {
          throw new ApiError(400, "Invalid Agent ID");
        }

        // Get the agent using the service
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Get the owner user information
        const owner = await services.userManager.getUser(agent.ownerId);

        // Prepare owner info for public display (null if user not found)
        const ownerInfo = owner
          ? {
              id: owner.id,
              name: owner.name || null,
              walletAddress: owner.walletAddress,
            }
          : null;

        const sanitizedAgent = services.agentManager.sanitizeAgent(agent);
        const computedAgent =
          await services.agentManager.attachAgentMetrics(sanitizedAgent);

        // Return the agent with owner information
        res.status(200).json({
          success: true,
          agent: computedAgent,
          owner: ownerInfo,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get balances for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getBalances(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Get the balances
        const balances = await services.balanceManager.getAllBalances(agentId);

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
          agentId,
          balances: enhancedBalances,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get portfolio information for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getPortfolio(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // First, check if there's an active competition
        const activeCompetition = await findActive();

        // Check if we have snapshot data (preferred method)
        if (activeCompetition) {
          // Try to get the latest snapshot for this agent
          const agentSnapshots = await getAgentPortfolioSnapshots(
            activeCompetition.id,
            agentId,
          );

          // If we have a snapshot, use it
          if (agentSnapshots.length > 0) {
            // Get the most recent snapshot
            const latestSnapshot = agentSnapshots[0]!;

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
              agentId,
              totalValue: latestSnapshot.totalValue,
              tokens: formattedTokens,
              snapshotTime: latestSnapshot.timestamp,
              source: "snapshot", // Indicate this is from a snapshot
            });
          }

          // No snapshot, but we should initiate one for future requests
          console.log(
            `[AgentController] No portfolio snapshots found for agent ${agentId} in competition ${activeCompetition.id}`,
          );
          // Request a snapshot for this agent asynchronously (don't await)
          services.portfolioSnapshotter
            .takePortfolioSnapshotForAgent(activeCompetition.id, agentId)
            .catch((error) => {
              console.error(
                `[AgentController] Error taking snapshot for agent ${agentId}:`,
                error,
              );
            });
        }

        // Fall back to calculating portfolio on-demand
        console.log(
          `[AgentController] Using live calculation for portfolio of agent ${agentId}`,
        );

        // Get the balances
        const balances = await services.balanceManager.getAllBalances(agentId);
        let totalValue = 0;
        const tokenValues = [];

        // Get unique token addresses
        const uniqueTokens = [
          ...new Set(balances.map((balance) => balance.tokenAddress)),
        ];

        // Get token info in bulk, this chunks dexscreener api requests to
        // reduce load and rate limiting.
        const tokenInfoMap =
          await services.priceTracker.getBulkTokenInfo(uniqueTokens);

        // Calculate values efficiently
        for (const balance of balances) {
          const tokenInfo = tokenInfoMap.get(balance.tokenAddress);
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
          agentId,
          totalValue,
          tokens: tokenValues,
          source: "live-calculation", // Indicate this is a live calculation
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get trade history for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getTrades(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Get the trades
        const trades = await services.tradeSimulator.getAgentTrades(agentId);

        // Sort trades by timestamp (newest first)
        const sortedTrades = [...trades].sort(
          (a, b) =>
            (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0),
        );

        // Return the trades
        res.status(200).json({
          success: true,
          agentId,
          trades: sortedTrades,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reset the API key for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async resetApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Use the AgentManager service to reset the API key
        const result = await services.agentManager.resetApiKey(agentId);

        // Return the new API key
        res.status(200).json({
          success: true,
          apiKey: result.apiKey,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competitions associated with the url param agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = ensureUuid(req.params.agentId);
        const filters = ensureAgentCompetitionFilters(req);
        const paging = ensurePaging(req);

        // Fetch all competitions associated with the agent
        const results = await services.agentManager.getCompetitionsForAgent(
          agentId,
          filters,
          paging,
        );

        res.status(200).json({
          success: true,
          competitions: results.competitions,
          pagination: {
            limit: paging.limit,
            offset: paging.offset,
            total: results.total,
            hasMore: paging.limit + paging.offset < results.total,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

/**
 * Type definition for AgentController
 */
export type AgentController = ReturnType<typeof makeAgentController>;
