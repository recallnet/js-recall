import * as crypto from "crypto";
import { generateNonce } from "siwe";
import { v4 as uuidv4 } from "uuid";
import { recoverMessageAddress } from "viem";

import { config } from "@/config/index.js";
import * as agentNonceRepo from "@/database/repositories/agent-nonce-repository.js";
import {
  count,
  countAgentCompetitionsForStatus,
  countByName,
  countByWallet,
  create,
  deactivateAgent,
  deleteAgent,
  findAgentCompetitions,
  findAll,
  findByCompetition,
  findById,
  findByName,
  findByOwnerId,
  findByWallet,
  findInactiveAgents,
  findUserAgentCompetitions,
  reactivateAgent,
  searchAgents,
  update,
} from "@/database/repositories/agent-repository.js";
import { getAgentRankById } from "@/database/repositories/agentrank-repository.js";
import {
  findBestPlacementForAgent,
  getAgentCompetitionRanking,
  getAgentPortfolioSnapshots,
  getLatestPortfolioSnapshots,
} from "@/database/repositories/competition-repository.js";
import {
  countAgentTrades,
  countAgentTradesInCompetition,
} from "@/database/repositories/trade-repository.js";
import { findByWalletAddress as findUserByWalletAddress } from "@/database/repositories/user-repository.js";
import { countTotalVotesForAgent } from "@/database/repositories/vote-repository.js";
import {
  InsertAgent,
  SelectAgent,
  SelectCompetition,
} from "@/database/schema/core/types.js";
import { ApiError } from "@/middleware/errorHandler.js";
import {
  AgentCompetitionsParams,
  AgentMetadata,
  AgentPublic,
  AgentPublicSchema,
  AgentSearchParams,
  AgentStats,
  ApiAuth,
  CompetitionAgentsParams,
  EnhancedCompetition,
  PagingParams,
  PagingParamsSchema,
} from "@/types/index.js";

/**
 * Agent Manager Service
 * Manages agent registration and API key authentication
 */
export class AgentManager {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, ApiAuth>;
  // Cache for inactive agents to avoid repeated database lookups
  private inactiveAgentsCache: Map<string, { reason: string; date: Date }>;

  constructor() {
    this.apiKeyCache = new Map();
    this.inactiveAgentsCache = new Map();
  }

  /**
   * Create a new agent
   * @param ownerId User ID who owns this agent
   * @param name Agent name
   * @param description Agent description
   * @param imageUrl Optional URL to the agent's image
   * @param metadata Optional agent metadata
   * @param email Optional email address
   * @param walletAddress Optional Ethereum wallet address
   * @returns The created agent with API credentials
   */
  async createAgent({
    ownerId,
    name,
    description,
    imageUrl,
    metadata,
    email,
    walletAddress,
  }: {
    ownerId: string;
    name: string;
    description?: string;
    imageUrl?: string;
    metadata?: AgentMetadata;
    email?: string;
    walletAddress?: string;
  }) {
    try {
      // Validate wallet address if provided
      if (walletAddress && !this.isValidEthereumAddress(walletAddress)) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }

      // Generate agent ID
      const id = uuidv4();

      // Generate API key (longer, more secure format)
      const apiKey = this.generateApiKey();

      // Encrypt API key for storage
      const encryptedApiKey = this.encryptApiKey(apiKey);

      // Create agent record
      const agent: InsertAgent = {
        id,
        ownerId,
        name,
        description,
        imageUrl,
        apiKey: encryptedApiKey, // Store encrypted key in database
        walletAddress,
        metadata,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const savedAgent = await create(agent);

      // Update cache with plaintext key
      this.apiKeyCache.set(apiKey, {
        agentId: id,
        key: apiKey,
      });

      console.log(
        `[AgentManager] Created agent: ${name} (${id}) for owner ${ownerId}`,
      );

      // Return agent with unencrypted apiKey for display to admin
      return {
        ...savedAgent,
        apiKey, // Return unencrypted key
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error("[AgentManager] Error creating agent:", error);
        throw error;
      }

      console.error("[AgentManager] Unknown error creating agent:", error);
      throw new Error(`Failed to create agent: ${error}`);
    }
  }

  /**
   * Validate an Ethereum address
   * @param address The Ethereum address to validate
   * @returns True if the address is valid
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get an agent by ID
   * @param agentId The agent ID
   * @returns The agent or null if not found
   */
  async getAgent(agentId: string) {
    try {
      return await findById(agentId);
    } catch (error) {
      console.error(`[AgentManager] Error retrieving agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get all agents for a specific owner
   * @param ownerId The owner user ID
   * @returns Array of agents owned by the user
   */
  async getAgentsByOwner(ownerId: string, pagingParams: PagingParams) {
    try {
      return await findByOwnerId(ownerId, pagingParams);
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving agents for owner ${ownerId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get the best placement of an agent across all competitions
   * @param agentId The agent ID
   * @returns The agent best placement
   */
  async getAgentBestPlacement(agentId: string) {
    try {
      const bestPlacement = await findBestPlacementForAgent(agentId);
      if (!bestPlacement) {
        return null;
      }
      return bestPlacement;
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving agent rank for ${agentId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all agents
   * @returns Array of all agents
   */
  async getAllAgents() {
    try {
      return await findAll();
    } catch (error) {
      console.error("[AgentManager] Error retrieving all agents:", error);
      return [];
    }
  }

  /**
   * Validate an API key and check if the agent is allowed to access
   * @param apiKey The API key to validate
   * @returns The agent ID if valid and not inactive, null otherwise
   * @throws Error if the agent is inactive
   */
  async validateApiKey(apiKey: string) {
    try {
      // First check cache
      const cachedAuth = this.apiKeyCache.get(apiKey);
      if (cachedAuth) {
        // Check if the agent is inactive
        if (this.inactiveAgentsCache.has(cachedAuth.agentId)) {
          const deactivationInfo = this.inactiveAgentsCache.get(
            cachedAuth.agentId,
          );
          throw new Error(
            `Your agent has been deactivated from the competition: ${deactivationInfo?.reason}`,
          );
        }
        return cachedAuth.agentId;
      }

      // If not in cache, search all agents and check if any decrypted key matches
      const agents = await findAll();

      for (const agent of agents) {
        try {
          const decryptedKey = this.decryptApiKey(agent.apiKey);

          if (decryptedKey === apiKey) {
            // Found matching agent, check if inactive
            if (agent.status !== "active") {
              // Cache the deactivation info
              this.inactiveAgentsCache.set(agent.id, {
                reason: agent.deactivationReason || "No reason provided",
                date: agent.deactivationDate || new Date(),
              });
              throw new Error(
                `Your agent has been deactivated from the competition: ${agent.deactivationReason}`,
              );
            }

            // Add to cache
            this.apiKeyCache.set(apiKey, {
              agentId: agent.id,
              key: apiKey,
            });

            return agent.id;
          }
        } catch (decryptError) {
          // Log but continue checking other agents
          console.error(
            `[AgentManager] Error decrypting key for agent ${agent.id}:`,
            decryptError,
          );
        }
      }

      // No matching agent found
      return null;
    } catch (error) {
      console.error("[AgentManager] Error validating API key:", error);
      throw error; // Re-throw to allow middleware to handle it
    }
  }

  /**
   * Generate a new API key
   * @returns A unique API key
   */
  public generateApiKey(): string {
    // Generate just 2 segments for a shorter key
    const segment1 = crypto.randomBytes(8).toString("hex"); // 16 chars
    const segment2 = crypto.randomBytes(8).toString("hex"); // 16 chars

    // Combine with a prefix and separator underscore for readability
    const key = `${segment1}_${segment2}`;
    console.log(`[AgentManager] Generated API key with length: ${key.length}`);
    return key;
  }

  /**
   * Encrypt an API key for database storage
   * @param key The API key to encrypt
   * @returns The encrypted key
   */
  public encryptApiKey(key: string): string {
    try {
      console.log(
        `[AgentManager] Encrypting API key with length: ${key.length}`,
      );
      const algorithm = "aes-256-cbc";
      const iv = crypto.randomBytes(16);

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const cipher = crypto.createCipheriv(algorithm, cryptoKey, iv);
      let encrypted = cipher.update(key, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return the IV and encrypted data together, clearly separated
      const result = `${iv.toString("hex")}:${encrypted}`;
      console.log(`[AgentManager] Encrypted key length: ${result.length}`);
      return result;
    } catch (error) {
      console.error("[AgentManager] Error encrypting API key:", error);
      throw new Error("Failed to encrypt API key");
    }
  }

  /**
   * Decrypt an encrypted API key
   * @param encryptedKey The encrypted API key
   * @returns The original API key
   */
  private decryptApiKey(encryptedKey: string): string {
    try {
      const algorithm = "aes-256-cbc";
      const parts = encryptedKey.split(":");

      if (parts.length !== 2) {
        throw new Error("Invalid encrypted key format");
      }

      const iv = Buffer.from(parts[0]!, "hex");
      const encrypted = parts[1]!;

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("[AgentManager] Error decrypting API key:", error);
      throw error;
    }
  }

  /**
   * Get a decrypted API key for a specific agent
   * This is intended only for admin access to help users that have lost their API keys
   * @param agentId ID of the agent whose API key should be retrieved
   * @returns Object with success status, the decrypted API key if successful, agent details, and error information if not
   */
  public async getDecryptedApiKeyById(agentId: string): Promise<{
    success: boolean;
    apiKey?: string;
    agent?: {
      id: string;
      name: string;
      ownerId: string;
    };
    errorCode?: number;
    errorMessage?: string;
  }> {
    try {
      // Get the agent
      const agent = await findById(agentId);

      if (!agent) {
        return {
          success: false,
          errorCode: 404,
          errorMessage: "Agent not found",
        };
      }

      try {
        // Use the private method to decrypt the key
        const apiKey = this.decryptApiKey(agent.apiKey);
        return {
          success: true,
          apiKey,
          agent: {
            id: agent.id,
            name: agent.name,
            ownerId: agent.ownerId,
          },
        };
      } catch (decryptError) {
        console.error(
          `[AgentManager] Error decrypting API key for agent ${agentId}:`,
          decryptError,
        );
        return {
          success: false,
          errorCode: 500,
          errorMessage: "Failed to decrypt API key",
        };
      }
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving decrypted API key for agent ${agentId}:`,
        error,
      );
      return {
        success: false,
        errorCode: 500,
        errorMessage: "Server error retrieving API key",
      };
    }
  }

  /**
   * Check if the system is healthy
   */
  async isHealthy() {
    try {
      const res = await count();
      return res >= 0;
    } catch (error) {
      console.error("[AgentManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Delete an agent by ID
   * @param agentId The agent ID to delete
   * @returns true if agent was deleted, false otherwise
   */
  async deleteAgent(agentId: string) {
    try {
      // Get the agent to find its API key
      const agent = await findById(agentId);

      if (!agent) {
        console.log(`[AgentManager] Agent not found for deletion: ${agentId}`);
        return false;
      }

      // Remove from cache if present
      if (agent.apiKey) {
        // Find and remove from API key cache
        for (const [key, auth] of this.apiKeyCache.entries()) {
          if (auth.agentId === agentId) {
            this.apiKeyCache.delete(key);
            break;
          }
        }
      }

      // Delete the agent from the database
      const deleted = await deleteAgent(agentId);

      if (deleted) {
        console.log(
          `[AgentManager] Successfully deleted agent: ${agent.name} (${agentId})`,
        );
      } else {
        console.log(
          `[AgentManager] Failed to delete agent: ${agent.name} (${agentId})`,
        );
      }

      return deleted;
    } catch (error) {
      console.error(`[AgentManager] Error deleting agent ${agentId}:`, error);
      throw new Error(
        `Failed to delete agent: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Deactivate an agent
   * @param agentId Agent ID to deactivate
   * @param reason Reason for deactivation
   * @returns The deactivated agent or null if agent not found
   */
  async deactivateAgent(agentId: string, reason: string) {
    try {
      console.log(
        `[AgentManager] Deactivating agent: ${agentId}, Reason: ${reason}`,
      );

      // Call repository to deactivate the agent
      const deactivatedAgent = await deactivateAgent(agentId, reason);

      if (!deactivatedAgent) {
        console.log(
          `[AgentManager] Agent not found for deactivation: ${agentId}`,
        );
        return null;
      }

      // Update deactivation cache
      this.inactiveAgentsCache.set(agentId, {
        reason: reason,
        date: deactivatedAgent.deactivationDate || new Date(),
      });

      console.log(
        `[AgentManager] Successfully deactivated agent: ${deactivatedAgent.name} (${agentId})`,
      );

      return deactivatedAgent;
    } catch (error) {
      console.error(
        `[AgentManager] Error deactivating agent ${agentId}:`,
        error,
      );
      throw new Error(
        `Failed to deactivate agent: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Reactivate an agent
   * @param agentId Agent ID to reactivate
   * @returns The reactivated agent or null if agent not found
   */
  async reactivateAgent(agentId: string) {
    try {
      console.log(`[AgentManager] Reactivating agent: ${agentId}`);

      // Call repository to reactivate the agent
      const reactivatedAgent = await reactivateAgent(agentId);

      if (!reactivatedAgent) {
        console.log(
          `[AgentManager] Agent not found for reactivation: ${agentId}`,
        );
        return null;
      }

      // Remove from inactive cache
      this.inactiveAgentsCache.delete(agentId);

      console.log(
        `[AgentManager] Successfully reactivated agent: ${reactivatedAgent.name} (${agentId})`,
      );

      return reactivatedAgent;
    } catch (error) {
      console.error(
        `[AgentManager] Error reactivating agent ${agentId}:`,
        error,
      );
      throw new Error(
        `Failed to reactivate agent: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Update an agent's information
   * @param agent The agent object with updated fields
   * @returns The updated agent or null if agent not found
   */
  async updateAgent(agent: InsertAgent) {
    try {
      console.log(`[AgentManager] Updating agent: ${agent.id} (${agent.name})`);

      // Check if agent exists
      const existingAgent = await findById(agent.id);
      if (!existingAgent) {
        console.log(`[AgentManager] Agent not found for update: ${agent.id}`);
        return undefined;
      }

      // Always set updated timestamp
      agent.updatedAt = new Date();

      // Save to database
      const updatedAgent = await update(agent);
      if (!updatedAgent) {
        console.log(`[AgentManager] Failed to update agent: ${agent.id}`);
        return undefined;
      }

      console.log(
        `[AgentManager] Successfully updated agent: ${updatedAgent.name} (${agent.id})`,
      );
      return updatedAgent;
    } catch (error) {
      console.error(`[AgentManager] Error updating agent ${agent.id}:`, error);
      throw new Error(
        `Failed to update agent: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Get all inactive agents
   * @returns Array of inactive agents
   */
  async getInactiveAgents() {
    try {
      return await findInactiveAgents();
    } catch (error) {
      console.error("[AgentManager] Error retrieving inactive agents:", error);
      return [];
    }
  }

  /**
   * Check if an agent is inactive
   * @param agentId Agent ID to check
   * @returns Object with inactive status and reason if applicable
   */
  async isAgentInactive(agentId: string): Promise<{
    isInactive: boolean;
    reason: string | null;
    date: Date | null;
  }> {
    try {
      // Check cache first
      const info = this.inactiveAgentsCache.get(agentId);
      if (info) {
        return {
          isInactive: true,
          reason: info.reason,
          date: info.date,
        };
      }

      // If not in cache, check database
      const agent = await findById(agentId);

      if (!agent) {
        return { isInactive: false, reason: null, date: null };
      }

      if (agent.status !== "active") {
        // Update cache
        this.inactiveAgentsCache.set(agentId, {
          reason: agent.deactivationReason || "No reason provided",
          date: agent.deactivationDate || new Date(),
        });

        return {
          isInactive: true,
          reason: agent.deactivationReason,
          date: agent.deactivationDate,
        };
      }

      return { isInactive: false, reason: null, date: null };
    } catch (error) {
      console.error(
        `[AgentManager] Error checking inactive status for agent ${agentId}:`,
        error,
      );
      return { isInactive: false, reason: null, date: null };
    }
  }

  /**
   * Reset an agent's API key
   * @param agentId The agent ID
   * @returns Object with new API key (unencrypted for display) and updated agent
   */
  async resetApiKey(agentId: string) {
    try {
      console.log(`[AgentManager] Resetting API key for agent: ${agentId}`);

      // Get the agent
      const agent = await findById(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      // Generate a new API key
      const newApiKey = this.generateApiKey();

      // Encrypt the new API key for storage
      const encryptedApiKey = this.encryptApiKey(newApiKey);

      // Update the agent with the new encrypted API key
      agent.apiKey = encryptedApiKey;
      agent.updatedAt = new Date();

      // Save the updated agent to the database
      const updatedAgent = await update(agent);
      if (!updatedAgent) {
        throw new Error(`Failed to update API key for agent ${agentId}`);
      }

      // Remove old API key from cache if it exists (find by agent ID)
      for (const [key, auth] of this.apiKeyCache.entries()) {
        if (auth.agentId === agentId) {
          this.apiKeyCache.delete(key);
          break;
        }
      }

      // Add new API key to cache
      this.apiKeyCache.set(newApiKey, {
        agentId: agentId,
        key: newApiKey,
      });

      console.log(
        `[AgentManager] Successfully reset API key for agent: ${agentId}`,
      );

      // Return the new API key (unencrypted) and the updated agent
      return {
        apiKey: newApiKey,
        agent: {
          ...updatedAgent,
          apiKey: newApiKey, // Return unencrypted for display to user
        },
      };
    } catch (error) {
      console.error(
        `[AgentManager] Error resetting API key for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Search for agents based on various attributes
   * @param searchParams Parameters to search by (name, ownerId, status)
   * @returns Array of agents matching the search criteria
   */
  async searchAgents(searchParams: AgentSearchParams) {
    try {
      console.log(
        `[AgentManager] Searching for agents with params:`,
        searchParams,
      );

      // Get matching agents from repository
      const agents = await searchAgents(searchParams);

      console.log(
        `[AgentManager] Found ${agents.length} agents matching search criteria`,
      );
      return agents;
    } catch (error) {
      console.error("[AgentManager] Error searching agents:", error);
      return [];
    }
  }

  /**
   * Get agents for a specific competition
   * @param competitionId Competition ID
   * @param params Competition agents parameters
   * @returns Object containing agents array and total count
   */
  async getAgentsForCompetition(
    competitionId: string,
    params: CompetitionAgentsParams,
  ) {
    try {
      console.log(
        `[AgentManager] Retrieving agents for competition ${competitionId} with params:`,
        params,
      );

      // Get agents from repository
      const result = await findByCompetition(competitionId, params);

      console.log(
        `[AgentManager] Found ${result.agents.length} agents for competition ${competitionId}`,
      );
      return result;
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving agents for competition ${competitionId}:`,
        error,
      );
      return { agents: [], total: 0 };
    }
  }

  /**
   * Get competitions for a specific agent
   * @param agentId Agent ID
   * @param params Agent competitions parameters
   * @returns Object containing agents array and total count
   */
  async getCompetitionsForAgent(
    agentId: string,
    filters: AgentCompetitionsParams,
    paging: PagingParams,
  ) {
    try {
      const params = {
        ...filters,
        ...paging,
      };
      console.log(
        `[AgentManager] Retrieving competitions for agent ${agentId} with params:`,
        params,
      );

      // Get competitions from repository
      const results = await findAgentCompetitions(agentId, params);

      // Attach metrics to each competition
      const enhancedCompetitions = await Promise.all(
        results.competitions.map(async (competition) => {
          if (!competition) return competition;
          return await this.attachCompetitionMetrics(competition, agentId);
        }),
      );

      // Handle computed field sorting if needed
      let finalCompetitions = enhancedCompetitions;
      if (results.isComputedSort && params.sort) {
        // Filter out null values before sorting
        const validCompetitions = enhancedCompetitions.filter(
          (comp): comp is EnhancedCompetition => comp !== null,
        );
        finalCompetitions = this.sortCompetitionsByComputedField(
          validCompetitions,
          params.sort,
        );

        // Apply pagination for computed sorting
        const startIndex = params.offset || 0;
        const endIndex = startIndex + (params.limit || 10);
        finalCompetitions = finalCompetitions.slice(startIndex, endIndex);
      }

      console.log(
        `[AgentManager] Found ${results.total} competitions for agent ${agentId}`,
      );
      return {
        competitions: finalCompetitions,
        total: results.total,
      };
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving competitions for agent ${agentId}:`,
        error,
      );
      return { competitions: [], total: 0 };
    }
  }

  /**
   * Get competitions for all agents owned by a user
   * @param userId User ID
   * @param params Agent competitions parameters
   * @returns Object containing competitions array and total count
   */
  async getCompetitionsForUserAgents(
    userId: string,
    params: AgentCompetitionsParams,
  ) {
    try {
      console.log(
        `[AgentManager] Retrieving competitions for user ${userId} agents with params:`,
        params,
      );

      const {
        data: pagingParams,
        success,
        error,
      } = PagingParamsSchema.safeParse(params);
      if (!success) {
        throw new ApiError(500, `cannot parse paging: ${error}`);
      }
      // Get all agents owned by this user
      const userAgents = await this.getAgentsByOwner(userId, pagingParams);
      const agentIds = userAgents.map((agent) => agent.id);

      if (agentIds.length === 0) {
        console.log(`[AgentManager] User ${userId} has no agents`);
        return { competitions: [], total: 0 };
      }

      // Get competitions for all user's agents
      const results = await findUserAgentCompetitions(agentIds, params);

      // Group by competition to avoid duplicates and format the
      // data to match what's expected by the client
      const agentCompetitions = new Map();
      results.competitions.forEach((data) => {
        if (!data.competitions) return;
        const comp =
          agentCompetitions.get(data.competitions.id) || data.competitions;
        const agent = data.agents ? this.sanitizeAgent(data.agents) : undefined;

        if (!Array.isArray(comp.agents)) comp.agents = [];

        if (
          typeof agent?.id === "string" &&
          !comp.agents.find((a: AgentPublic) => a.id === agent?.id)
        ) {
          comp.agents.push(agent);
        }

        agentCompetitions.set(data.competitions.id, comp);
      });

      // TODO: since rankings are not really done, need to make a bunch of db calls and get rankings
      //  for every competition in this result set and make sure to append the agent's rank to the
      //  response data.
      await Promise.all(
        Array.from(agentCompetitions.keys()).map(async (compId: string) => {
          const agentComp = agentCompetitions.get(compId);
          const snapshots = await getLatestPortfolioSnapshots(compId);
          const rankings = snapshots.sort(
            (a, b) => b.totalValue - a.totalValue,
          );

          for (const agent of agentComp.agents) {
            // rank == 0 means no snapshots/rankings for competition yet
            const rank =
              rankings.findIndex((snap) => snap.agentId === agent.id) + 1;
            // agent is a reference so we can set here
            agent.rank = rank;
          }
        }),
      );

      console.log(
        `[AgentManager] Found ${results.total} competitions containing agents owned by user ${userId}`,
      );
      return {
        ...results,
        competitions: Array.from(agentCompetitions.values()),
      };
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving competitions for user ${userId} agents:`,
        error,
      );
      return { competitions: [], total: 0 };
    }
  }

  /**
   * Get agents with paging and filtering
   */
  async getAgents({
    filter,
    pagingParams,
  }: {
    filter?: string;
    pagingParams: PagingParams;
  }) {
    if (filter?.length === 42) {
      return findByWallet({ walletAddress: filter, pagingParams });
    }
    if (typeof filter === "string" && filter.length > 0) {
      return findByName({ name: filter, pagingParams });
    }

    return findAll(pagingParams);
  }

  /**
   * Count agents with optional filter
   * @param filter Filter by wallet address or name
   * @returns Number of agents matching the filter
   */
  async countAgents(filter?: string) {
    if (filter?.length === 42) {
      return countByWallet(filter);
    }
    if (filter?.length) {
      return countByName(filter);
    }

    return count();
  }

  /**
   * Sanitize an agent object for public display
   * @param agent The agent object to sanitize
   * @returns The sanitized agent object
   */
  sanitizeAgent(agent: SelectAgent) {
    return AgentPublicSchema.parse({
      ...agent,
      isVerified: !!agent.walletAddress,
    });
  }

  /**
   * Attach agent metrics to an agent object
   * @param sanitizedAgent The sanitized agent object
   * @returns The agent object with metrics attached
   */
  async attachAgentMetrics(
    sanitizedAgent: ReturnType<AgentManager["sanitizeAgent"]>,
  ) {
    const metadata = sanitizedAgent.metadata as AgentMetadata;
    const completedCompetitions = await countAgentCompetitionsForStatus(
      sanitizedAgent.id,
      ["ended"], // Only get completed competitions
    );
    const totalVotes = await countTotalVotesForAgent(sanitizedAgent.id);
    const totalTrades = await countAgentTrades(sanitizedAgent.id);
    const bestPlacement =
      (await this.getAgentBestPlacement(sanitizedAgent.id)) || undefined;

    const agentRank = await getAgentRankById(sanitizedAgent.id);
    const rank = agentRank?.rank;
    const score = agentRank?.score;

    const stats = {
      completedCompetitions,
      totalVotes,
      totalTrades,
      bestPlacement,
      rank,
      score,
    } as AgentStats;

    return {
      ...sanitizedAgent,
      stats,
      trophies: metadata?.trophies || [],
      skills: metadata?.skills || [],
      hasUnclaimedRewards: metadata?.hasUnclaimedRewards || false,
    };
  }

  /**
   * Attach agent-specific metrics to a competition object
   * @param competition The competition object to enhance
   * @param agentId The agent ID for metrics calculation
   * @returns Enhanced competition with agent metrics
   */
  async attachCompetitionMetrics(
    competition: SelectCompetition,
    agentId: string,
  ): Promise<EnhancedCompetition> {
    try {
      // Get portfolio value (latest snapshot for agent in competition)
      const agentSnapshots = await getAgentPortfolioSnapshots(
        competition.id,
        agentId,
      );
      const latestSnapshot = agentSnapshots?.[0]; // Already ordered by timestamp desc
      const portfolioValue = latestSnapshot
        ? Number(latestSnapshot.totalValue)
        : 0;

      // Calculate PnL (similar to calculateAgentMetrics pattern)
      let pnl = 0;
      let pnlPercent = 0;
      if (agentSnapshots && agentSnapshots.length > 1) {
        const startingValue = Number(
          agentSnapshots[agentSnapshots.length - 1]?.totalValue || 0,
        );
        const currentValue = Number(agentSnapshots[0]?.totalValue || 0);
        pnl = currentValue - startingValue;
        pnlPercent = startingValue > 0 ? (pnl / startingValue) * 100 : 0;
      }

      // Get total trades for agent in this competition
      const totalTrades = await countAgentTradesInCompetition(
        agentId,
        competition.id,
      );

      // Get agent's ranking in this competition
      const bestPlacement = await getAgentCompetitionRanking(
        agentId,
        competition.id,
      );

      return {
        ...competition,
        portfolioValue,
        pnl,
        pnlPercent,
        totalTrades,
        bestPlacement,
      };
    } catch (error) {
      console.error(
        `[AgentManager] Error attaching competition metrics for agent ${agentId} in competition ${competition.id}:`,
        error,
      );
      // Return competition with default values on error
      return {
        ...competition,
        portfolioValue: 0,
        pnl: 0,
        pnlPercent: 0,
        totalTrades: 0,
        bestPlacement: { rank: 0, totalAgents: 0 },
      };
    }
  }

  /**
   * Sort competitions by computed fields
   * @param competitions Array of competitions with metrics
   * @param sortString Sort string (e.g., "portfolioValue", "-pnl")
   * @returns Sorted competitions array
   */
  private sortCompetitionsByComputedField(
    competitions: EnhancedCompetition[],
    sortString: string,
  ): EnhancedCompetition[] {
    const parts = sortString.split(",");
    const sortField = parts[0];
    if (!sortField) return competitions;

    const isDesc = sortField.startsWith("-");
    const field = isDesc ? sortField.slice(1) : sortField;

    return competitions.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (field) {
        case "portfolioValue":
          aValue = a.portfolioValue || 0;
          bValue = b.portfolioValue || 0;
          break;
        case "pnl":
          aValue = a.pnl || 0;
          bValue = b.pnl || 0;
          break;
        case "totalTrades":
          aValue = a.totalTrades || 0;
          bValue = b.totalTrades || 0;
          break;
        case "rank":
          aValue = a.bestPlacement?.rank || 0;
          bValue = b.bestPlacement?.rank || 0;
          // For rank, lower is better, so reverse the comparison
          return isDesc ? aValue - bValue : bValue - aValue;
        default:
          return 0;
      }

      return isDesc ? bValue - aValue : aValue - bValue;
    });
  }

  /**
   * Verify wallet ownership for an agent via custom message signature
   * @param agentId The agent ID to update
   * @param message The verification message
   * @param signature The signature of the message
   * @returns Verification result
   */
  async verifyWalletOwnership(
    agentId: string,
    message: string,
    signature: string,
  ): Promise<{
    success: boolean;
    walletAddress?: string;
    error?: string;
  }> {
    try {
      // Parse custom message format
      const parseResult = this.parseVerificationMessage(message);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const { timestamp, domain, purpose, nonce } = parseResult;

      // Validate message content using config
      if (domain !== config.api.domain) {
        return { success: false, error: "Invalid domain" };
      }

      if (purpose !== "WALLET_VERIFICATION") {
        return { success: false, error: "Invalid purpose" };
      }

      // Ensure we have all required fields (TypeScript safety)
      if (!timestamp || !nonce) {
        return {
          success: false,
          error: "Missing required fields in parsed message",
        };
      }

      // Validate timestamp (5-minute window with clock skew tolerance)
      const timestampDate = new Date(timestamp);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const clockSkewTolerance = new Date(now.getTime() + 30 * 1000); // 30 second tolerance for clock skew

      if (timestampDate < fiveMinutesAgo) {
        return { success: false, error: "Message timestamp too old" };
      }

      if (timestampDate > clockSkewTolerance) {
        return {
          success: false,
          error: "Message timestamp too far in the future",
        };
      }

      // Validate and consume nonce (now required)
      const nonceValidation = await this.validateAndConsumeNonce(
        agentId,
        nonce,
      );
      if (!nonceValidation.success) {
        return {
          success: false,
          error: nonceValidation.error || "Nonce validation failed",
        };
      }

      // Verify signature and recover wallet address
      let walletAddress: string;
      try {
        walletAddress = (
          await recoverMessageAddress({
            message,
            signature: signature as `0x${string}`,
          })
        ).toLowerCase();
      } catch (error) {
        console.error("[AgentManager] Error recovering wallet address:", error);
        return { success: false, error: "Invalid signature" };
      }

      // Check cross-table uniqueness
      const existingUser = await findUserByWalletAddress(walletAddress);
      if (existingUser) {
        return {
          success: false,
          error: "Wallet address already associated with a user account",
        };
      }

      const existingAgents = await findByWallet({
        walletAddress,
        pagingParams: { limit: 1, offset: 0, sort: "createdAt" },
      });
      const existingAgent = existingAgents[0];
      if (existingAgent && existingAgent.id !== agentId) {
        return {
          success: false,
          error: "Wallet address already associated with another agent",
        };
      }

      // Get and update agent wallet address
      const agent = await this.getAgent(agentId);
      if (!agent) {
        return { success: false, error: "Agent not found" };
      }

      const updatedAgent = await this.updateAgent({
        ...agent,
        walletAddress,
      });

      if (!updatedAgent) {
        return {
          success: false,
          error: "Failed to update agent wallet address",
        };
      }

      return { success: true, walletAddress };
    } catch (error) {
      console.error("[AgentManager] Error in verifyWalletOwnership:", error);
      return { success: false, error: "Verification failed" };
    }
  }

  /**
   * Parse custom verification message format
   */
  private parseVerificationMessage(message: string): {
    success: boolean;
    timestamp?: string;
    domain?: string;
    purpose?: string;
    nonce?: string;
    error?: string;
  } {
    try {
      const lines = message.trim().split("\n");

      if (lines[0] !== "VERIFY_WALLET_OWNERSHIP") {
        return { success: false, error: "Invalid message header" };
      }

      const timestampLine = lines.find((line) =>
        line.startsWith("Timestamp: "),
      );
      const domainLine = lines.find((line) => line.startsWith("Domain: "));
      const purposeLine = lines.find((line) => line.startsWith("Purpose: "));
      const nonceLine = lines.find((line) => line.startsWith("Nonce: "));

      if (!timestampLine || !domainLine || !purposeLine) {
        return { success: false, error: "Missing required message fields" };
      }

      if (!nonceLine) {
        return { success: false, error: "Nonce is required" };
      }

      const timestamp = timestampLine.replace("Timestamp: ", "");
      const domain = domainLine.replace("Domain: ", "");
      const purpose = purposeLine.replace("Purpose: ", "");
      const nonce = nonceLine.replace("Nonce: ", "");

      return {
        success: true,
        timestamp,
        domain,
        purpose,
        nonce,
      };
    } catch (error) {
      console.error(
        "[AgentManager] Error parsing verification message:",
        error,
      );
      return { success: false, error: "Failed to parse message" };
    }
  }

  /**
   * Generate a nonce for agent wallet verification
   * @param agentId The agent ID requesting a nonce
   * @returns Generated nonce
   */
  async generateNonceForAgent(agentId: string): Promise<{
    success: boolean;
    nonce?: string;
    error?: string;
  }> {
    try {
      // Generate a cryptographically secure nonce
      const nonce = generateNonce();

      // Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Clean up any existing nonces for this agent to keep table clean
      await agentNonceRepo.deleteByAgentId(agentId);

      // Store in database
      await agentNonceRepo.create({
        id: uuidv4(),
        agentId,
        nonce,
        expiresAt,
      });

      return { success: true, nonce };
    } catch (error) {
      console.error("[AgentManager] Error generating nonce:", error);
      return { success: false, error: "Failed to generate nonce" };
    }
  }

  /**
   * Validate and consume a nonce for agent wallet verification
   * @param agentId The agent ID using the nonce
   * @param nonce The nonce to validate and consume
   * @returns Validation result
   */
  async validateAndConsumeNonce(
    agentId: string,
    nonce: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Find the nonce
      const nonceRecord = await agentNonceRepo.findByNonce(nonce);

      if (!nonceRecord) {
        return { success: false, error: "Invalid nonce" };
      }

      // Check if nonce belongs to the agent
      if (nonceRecord.agentId !== agentId) {
        return { success: false, error: "Nonce does not belong to this agent" };
      }

      // Check if nonce is already used
      if (nonceRecord.usedAt) {
        return { success: false, error: "Nonce already used" };
      }

      // Check if nonce is expired
      if (new Date() > nonceRecord.expiresAt) {
        return { success: false, error: "Nonce expired" };
      }

      // Mark nonce as used
      await agentNonceRepo.markAsUsed(nonce);

      return { success: true };
    } catch (error) {
      console.error("[AgentManager] Error validating nonce:", error);
      return { success: false, error: "Failed to validate nonce" };
    }
  }

  /**
   * Clean up expired nonces (can be called by a background job)
   * @returns Number of cleaned up nonces
   */
  async cleanupExpiredNonces(): Promise<number> {
    try {
      return await agentNonceRepo.deleteExpired();
    } catch (error) {
      console.error("[AgentManager] Error cleaning up expired nonces:", error);
      return 0;
    }
  }
}
