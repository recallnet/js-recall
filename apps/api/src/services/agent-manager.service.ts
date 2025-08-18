import * as crypto from "crypto";
import { DatabaseError } from "pg";
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
  getBulkAgentTrophies,
  reactivateAgent,
  searchAgents,
  update,
} from "@/database/repositories/agent-repository.js";
import { getAgentRankById } from "@/database/repositories/agentscore-repository.js";
import {
  findBestPlacementForAgent,
  getAgentCompetitionRanking,
  getBoundedSnapshots,
  getBulkAgentCompetitionRankings,
} from "@/database/repositories/competition-repository.js";
import { createEmailVerificationToken } from "@/database/repositories/email-verification-repository.js";
import {
  getAgentTotalRoi,
  getBulkAgentMetrics,
} from "@/database/repositories/leaderboard-repository.js";
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
import { serviceLogger } from "@/lib/logger.js";
import { transformToTrophy } from "@/lib/trophy-utils.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { EmailService } from "@/services/email.service.js";
import {
  ACTOR_STATUS,
  AgentCompetitionsParams,
  AgentMetadata,
  AgentPublic,
  AgentPublicSchema,
  AgentSearchParams,
  AgentStats,
  AgentTrophy,
  ApiAuth,
  EnhancedCompetition,
  PagingParams,
  PagingParamsSchema,
} from "@/types/index.js";
import { AgentQueryParams } from "@/types/sort/agent.js";

/**
 * Agent Manager Service
 * Manages agent registration and API key authentication
 */
export class AgentManager {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, ApiAuth>;
  // Cache for inactive agents to avoid repeated database lookups
  private inactiveAgentsCache: Map<string, { reason: string; date: Date }>;
  // Email service for sending verification emails
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.apiKeyCache = new Map();
    this.inactiveAgentsCache = new Map();
    this.emailService = emailService;
  }

  /**
   * Create a new agent
   * @param ownerId User ID who owns this agent
   * @param name Agent name
   * @param handle Optional agent handle (auto-generated if not provided)
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
    handle,
    description,
    imageUrl,
    metadata,
    email,
    walletAddress,
  }: {
    ownerId: string;
    name: string;
    handle: string;
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
        handle,
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
      let savedAgent;
      try {
        savedAgent = await create(agent);
      } catch (error) {
        if (error instanceof DatabaseError) {
          // Check for unique constraint violations
          if (error.code === "23505") {
            if (error.constraint === "agents_handle_key") {
              throw new ApiError(
                409,
                `An agent with handle '${handle}' already exists`,
              );
            }
            if (error.constraint === "agents_owner_id_name_key") {
              throw new ApiError(
                409,
                `You already have an agent with name '${name}'`,
              );
            }
            if (error.constraint === "agents_wallet_address_key") {
              throw new ApiError(
                409,
                `An agent with wallet address '${walletAddress}' already exists`,
              );
            }
          }
        }
        throw error;
      }

      // Update cache with plaintext key
      this.apiKeyCache.set(apiKey, {
        agentId: id,
        key: apiKey,
      });

      if (email) {
        await this.sendEmailVerification(savedAgent);
      }

      serviceLogger.debug(
        `[AgentManager] Created agent: ${name} (${id}) for owner ${ownerId}`,
      );

      // Return agent with unencrypted apiKey for display to admin
      return {
        ...savedAgent,
        apiKey, // Return unencrypted key
      };
    } catch (error) {
      serviceLogger.error("[AgentManager] Error creating agent:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(
        `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      serviceLogger.error(
        `[AgentManager] Error retrieving agent ${agentId}:`,
        error,
      );
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
      serviceLogger.error(
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
      serviceLogger.error(
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
      serviceLogger.error("[AgentManager] Error retrieving all agents:", error);
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
            // Found matching agent, check if globally suspended/deleted
            // Note: We now allow "inactive" agents to authenticate for non-competition operations
            if (
              agent.status === ACTOR_STATUS.SUSPENDED ||
              agent.status === ACTOR_STATUS.DELETED
            ) {
              // Cache the deactivation info
              this.inactiveAgentsCache.set(agent.id, {
                reason: agent.deactivationReason || "No reason provided",
                date: agent.deactivationDate || new Date(),
              });
              throw new Error(
                `Your agent has been ${agent.status}: ${agent.deactivationReason}`,
              );
            }

            // Add to cache (now includes inactive agents for per-competition checking)
            this.apiKeyCache.set(apiKey, {
              agentId: agent.id,
              key: apiKey,
            });

            return agent.id;
          }
        } catch (decryptError) {
          // Log but continue checking other agents
          serviceLogger.error(
            `[AgentManager] Error decrypting key for agent ${agent.id}:`,
            decryptError,
          );
        }
      }

      // No matching agent found
      return null;
    } catch (error) {
      serviceLogger.error("[AgentManager] Error validating API key:", error);
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
    serviceLogger.debug(
      `[AgentManager] Generated API key with length: ${key.length}`,
    );
    return key;
  }

  /**
   * Encrypt an API key for database storage
   * @param key The API key to encrypt
   * @returns The encrypted key
   */
  public encryptApiKey(key: string): string {
    try {
      serviceLogger.debug(
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
      serviceLogger.debug(
        `[AgentManager] Encrypted key length: ${result.length}`,
      );
      return result;
    } catch (error) {
      serviceLogger.error("[AgentManager] Error encrypting API key:", error);
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
      serviceLogger.error("[AgentManager] Error decrypting API key:", error);
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
        serviceLogger.error(
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
      serviceLogger.error(
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
      serviceLogger.error("[AgentManager] Health check failed:", error);
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
        serviceLogger.debug(
          `[AgentManager] Agent not found for deletion: ${agentId}`,
        );
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
        serviceLogger.debug(
          `[AgentManager] Successfully deleted agent: ${agent.name} (${agentId})`,
        );
      } else {
        serviceLogger.debug(
          `[AgentManager] Failed to delete agent: ${agent.name} (${agentId})`,
        );
      }

      return deleted;
    } catch (error) {
      serviceLogger.error(
        `[AgentManager] Error deleting agent ${agentId}:`,
        error,
      );
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
      serviceLogger.debug(
        `[AgentManager] Deactivating agent: ${agentId}, Reason: ${reason}`,
      );

      // Call repository to deactivate the agent
      const deactivatedAgent = await deactivateAgent(agentId, reason);

      if (!deactivatedAgent) {
        serviceLogger.debug(
          `[AgentManager] Agent not found for deactivation: ${agentId}`,
        );
        return null;
      }

      // Update deactivation cache
      this.inactiveAgentsCache.set(agentId, {
        reason: reason,
        date: deactivatedAgent.deactivationDate || new Date(),
      });

      serviceLogger.debug(
        `[AgentManager] Successfully deactivated agent: ${deactivatedAgent.name} (${agentId})`,
      );

      return deactivatedAgent;
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.debug(`[AgentManager] Reactivating agent: ${agentId}`);

      // Call repository to reactivate the agent
      const reactivatedAgent = await reactivateAgent(agentId);

      if (!reactivatedAgent) {
        serviceLogger.debug(
          `[AgentManager] Agent not found for reactivation: ${agentId}`,
        );
        return null;
      }

      // Remove from inactive cache
      this.inactiveAgentsCache.delete(agentId);

      serviceLogger.debug(
        `[AgentManager] Successfully reactivated agent: ${reactivatedAgent.name} (${agentId})`,
      );

      return reactivatedAgent;
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.debug(
        `[AgentManager] Updating agent: ${agent.id} (${agent.name})`,
      );

      // Check if agent exists
      const existingAgent = await findById(agent.id);
      if (!existingAgent) {
        serviceLogger.debug(
          `[AgentManager] Agent not found for update: ${agent.id}`,
        );
        return undefined;
      }

      // Check if email has changed and needs verification
      const emailChanged = agent.email && agent.email !== existingAgent.email;
      if (emailChanged) {
        agent.isEmailVerified = false;
      }

      // Always set updated timestamp
      agent.updatedAt = new Date();

      // Save to database
      let updatedAgent;
      try {
        updatedAgent = await update(agent);
        if (!updatedAgent) {
          serviceLogger.debug(
            `[AgentManager] Failed to update agent: ${agent.id}`,
          );
          return undefined;
        }
      } catch (error) {
        if (error instanceof DatabaseError) {
          // Check for unique constraint violations
          if (error.code === "23505") {
            if (error.constraint === "agents_handle_key") {
              throw new ApiError(
                409,
                `An agent with handle '${agent.handle}' already exists`,
              );
            }
            if (error.constraint === "agents_owner_id_name_key") {
              throw new ApiError(
                409,
                `You already have an agent with name '${agent.name}'`,
              );
            }
            if (error.constraint === "agents_wallet_address_key") {
              throw new ApiError(
                409,
                `An agent with wallet address '${agent.walletAddress}' already exists`,
              );
            }
          }
        }
        throw error;
      }

      // Send verification email if email has changed
      if (emailChanged && updatedAgent.email) {
        await this.sendEmailVerification(updatedAgent);
      }

      serviceLogger.debug(
        `[AgentManager] Successfully updated agent: ${updatedAgent.name} (${agent.id})`,
      );
      return updatedAgent;
    } catch (error) {
      // Re-throw ApiError instances directly
      if (error instanceof ApiError) {
        throw error;
      }

      serviceLogger.error(
        `[AgentManager] Error updating agent ${agent.id}:`,
        error,
      );
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
      serviceLogger.error(
        "[AgentManager] Error retrieving inactive agents:",
        error,
      );
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
      serviceLogger.error(
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
      serviceLogger.debug(
        `[AgentManager] Resetting API key for agent: ${agentId}`,
      );

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

      serviceLogger.debug(
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
      serviceLogger.error(
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
      serviceLogger.debug(
        `[AgentManager] Searching for agents with params:`,
        searchParams,
      );

      // Get matching agents from repository
      const agents = await searchAgents(searchParams);

      serviceLogger.debug(
        `[AgentManager] Found ${agents.length} agents matching search criteria`,
      );
      return agents;
    } catch (error) {
      serviceLogger.error("[AgentManager] Error searching agents:", error);
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
    params: AgentQueryParams,
  ) {
    try {
      serviceLogger.debug(
        `[AgentManager] Retrieving agents for competition ${competitionId} with params:`,
        params,
      );

      // Get agents from repository
      const { agents, total } = await findByCompetition(competitionId, params);

      serviceLogger.debug(
        `[AgentManager] Found ${agents.length} agents for competition ${competitionId}`,
      );
      return { agents, total };
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.debug(
        `[AgentManager] Retrieving competitions for agent ${agentId} with params:`,
        params,
      );

      // Get competitions from repository
      const results = await findAgentCompetitions(agentId, params);

      // Filter out null competitions and ensure required fields are present
      const validCompetitions = results.competitions.filter(
        (comp) => comp !== null,
      ) as SelectCompetition[];

      // Attach metrics to each valid competition
      const enhancedCompetitions = await Promise.all(
        validCompetitions.map(
          async (competition) =>
            await this.attachCompetitionMetrics(competition, agentId),
        ),
      );

      // Handle computed field sorting if needed
      let finalCompetitions = enhancedCompetitions;
      if (results.isComputedSort && params.sort) {
        finalCompetitions = this.sortCompetitionsByComputedField(
          enhancedCompetitions, // No need to filter again
          params.sort,
        );

        // Apply pagination for computed sorting
        const startIndex = params.offset || 0;
        const endIndex = startIndex + (params.limit || 10);
        finalCompetitions = finalCompetitions.slice(startIndex, endIndex);
      }

      serviceLogger.debug(
        `[AgentManager] Found ${results.total} competitions for agent ${agentId}`,
      );
      return {
        competitions: finalCompetitions,
        total: results.total,
      };
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.debug(
        `[AgentManager] Retrieving competitions for user ${userId} agents with params:`,
        params,
      );

      // Service layer validates business inputs
      const {
        data: validatedParams,
        success,
        error,
      } = PagingParamsSchema.safeParse(params);
      if (!success) {
        throw new ApiError(400, `Invalid pagination parameters: ${error}`);
      }

      // Validate sort parameter early (before checking if user has agents)
      // This ensures consistent error handling regardless of user's agent count
      if (validatedParams.sort) {
        const validSortFields = [
          "name",
          "startDate",
          "endDate",
          "createdAt",
          "status",
          "agentName",
          "agentHandle",
          "rank",
        ];
        const sortParts = validatedParams.sort.split(",");

        for (const part of sortParts) {
          const fieldName = part.startsWith("-") ? part.slice(1) : part;
          if (!validSortFields.includes(fieldName)) {
            throw new ApiError(400, `cannot sort by field: '${fieldName}'`);
          }
        }
      }

      // Get user agents (no competition sort - we're sorting competitions, not agents)
      const userAgents = await this.getAgentsByOwner(userId, {
        sort: "",
        limit: 100,
        offset: 0,
      });
      const agentIds = userAgents.map((agent) => agent.id);

      if (agentIds.length === 0) {
        serviceLogger.debug(`[AgentManager] User ${userId} has no agents`);
        return { competitions: [], total: 0 };
      }

      // Combine validated pagination with other parameters
      const competitionParams = {
        ...params, // Keep business fields (status, claimed, etc.)
        ...validatedParams, // Use validated pagination (sort, limit, offset)
      };

      // Use optimized repository method that handles both database and computed sorting efficiently
      const results = await findUserAgentCompetitions(
        agentIds,
        competitionParams,
      );

      // Handle computed field sorting if needed (optimized version still needs service-layer sorting for computed fields)
      if (results.isComputedSort && validatedParams.sort) {
        // Group competitions first, then sort them
        const agentCompetitions = new Map();

        results.competitions.forEach((data) => {
          if (!data.competitions) return;

          const competitionId = data.competitions.id;
          const comp =
            agentCompetitions.get(competitionId) || data.competitions;
          const agent = data.agents
            ? this.sanitizeAgent(data.agents)
            : undefined;

          if (!Array.isArray(comp.agents)) comp.agents = [];

          if (
            typeof agent?.id === "string" &&
            !comp.agents.find((a: AgentPublic) => a.id === agent?.id)
          ) {
            comp.agents.push(agent);
          }

          agentCompetitions.set(competitionId, comp);
        });

        // Get all unique competitions for sorting
        const allCompetitions = Array.from(agentCompetitions.values());

        // Add rankings to competitions for sorting - optimized version with bulk ranking fallback
        for (const comp of allCompetitions) {
          // First pass: try to get ranks from leaderboard data (already joined in optimized query)
          const agentsNeedingRankFallback: Array<{
            agent: AgentPublic & { rank?: number };
            index: number;
          }> = [];

          for (let i = 0; i < comp.agents.length; i++) {
            const agent = comp.agents[i];
            const leaderboardData = results.competitions.find(
              (data) =>
                data.competitions?.id === comp.id &&
                data.agents?.id === agent.id,
            )?.competitions_leaderboard;

            if (leaderboardData?.rank) {
              agent.rank = leaderboardData.rank;
            } else {
              // Mark agent as needing rank fallback
              agentsNeedingRankFallback.push({ agent, index: i });
            }
          }

          // Bulk fallback ranking for agents missing leaderboard data
          if (agentsNeedingRankFallback.length > 0) {
            const agentIds = agentsNeedingRankFallback.map(
              ({ agent }) => agent.id,
            );
            const bulkRankings = await getBulkAgentCompetitionRankings(
              comp.id,
              agentIds,
            );

            // Apply bulk ranking results
            for (const { agent } of agentsNeedingRankFallback) {
              const rankResult = bulkRankings.get(agent.id);
              agent.rank = rankResult?.rank;
            }
          }

          // Sort agents within the competition by rank (best rank first)
          comp.agents.sort(
            (
              a: AgentPublic & { rank?: number },
              b: AgentPublic & { rank?: number },
            ) => {
              const aRank = a.rank;
              const bRank = b.rank;

              // Handle undefined ranks - put them at the end
              if (aRank === undefined && bRank === undefined) return 0;
              if (aRank === undefined) return 1;
              if (bRank === undefined) return -1;

              // Lower rank number = better performance
              return aRank - bRank;
            },
          );
        }

        // Sort competitions using computed fields
        const sortedCompetitions = this.sortCompetitionsByComputedField(
          allCompetitions,
          validatedParams.sort,
        );

        // Apply pagination manually for computed sorting
        const startIndex = validatedParams.offset || 0;
        const endIndex = startIndex + (validatedParams.limit || 10);
        const paginatedCompetitions = sortedCompetitions.slice(
          startIndex,
          endIndex,
        );

        return {
          competitions: paginatedCompetitions,
          total: results.total,
          hasMore: endIndex < results.total,
          limit: validatedParams.limit || 10,
          offset: validatedParams.offset || 0,
        };
      }

      // Group by competition to avoid duplicates while preserving sort order
      // Track order of competitions as they appear in sorted results
      const agentCompetitions = new Map();
      const competitionOrder: string[] = [];

      results.competitions.forEach((data) => {
        if (!data.competitions) return;

        const competitionId = data.competitions.id;
        const comp = agentCompetitions.get(competitionId) || data.competitions;
        const agent = data.agents ? this.sanitizeAgent(data.agents) : undefined;

        if (!Array.isArray(comp.agents)) comp.agents = [];

        if (
          typeof agent?.id === "string" &&
          !comp.agents.find((a: AgentPublic) => a.id === agent?.id)
        ) {
          comp.agents.push(agent);
        }

        // Track order only on first encounter to preserve sort order
        if (!agentCompetitions.has(competitionId) && competitionId) {
          competitionOrder.push(competitionId);
        }

        agentCompetitions.set(competitionId, comp);
      });

      // Add rankings using leaderboard data from optimized query (with bulk fallback)
      for (const compId of Array.from(agentCompetitions.keys())) {
        const agentComp = agentCompetitions.get(compId);

        // First pass: try to get ranks from leaderboard data (already joined in optimized query)
        const agentsNeedingRankFallback: Array<{
          agent: AgentPublic & { rank?: number };
          index: number;
        }> = [];

        for (let i = 0; i < agentComp.agents.length; i++) {
          const agent = agentComp.agents[i];
          const leaderboardData = results.competitions.find(
            (data) =>
              data.competitions?.id === compId && data.agents?.id === agent.id,
          )?.competitions_leaderboard;

          if (leaderboardData?.rank) {
            agent.rank = leaderboardData.rank;
          } else {
            // Mark agent as needing rank fallback
            agentsNeedingRankFallback.push({ agent, index: i });
          }
        }

        // Bulk fallback ranking for agents missing leaderboard data
        if (agentsNeedingRankFallback.length > 0) {
          const agentIds = agentsNeedingRankFallback.map(
            ({ agent }) => agent.id,
          );
          const bulkRankings = await getBulkAgentCompetitionRankings(
            compId,
            agentIds,
          );

          // Apply bulk ranking results
          for (const { agent } of agentsNeedingRankFallback) {
            const rankResult = bulkRankings.get(agent.id);
            agent.rank = rankResult?.rank;
          }
        }

        // Sort agents within the competition by rank (best rank first)
        agentComp.agents.sort(
          (
            a: AgentPublic & { rank?: number },
            b: AgentPublic & { rank?: number },
          ) => {
            const aRank = a.rank;
            const bRank = b.rank;

            // Handle undefined ranks - put them at the end
            if (aRank === undefined && bRank === undefined) return 0;
            if (aRank === undefined) return 1;
            if (bRank === undefined) return -1;

            // Lower rank number = better performance
            return aRank - bRank;
          },
        );
      }

      serviceLogger.debug(
        `[AgentManager] Found ${results.total} competitions containing agents owned by user ${userId}`,
      );

      // Return competitions in the original sorted order
      const sortedCompetitions = competitionOrder.map((id) =>
        agentCompetitions.get(id),
      );

      return {
        ...results,
        competitions: sortedCompetitions,
      };
    } catch (error) {
      serviceLogger.error(
        `[AgentManager] Error retrieving competitions for user ${userId} agents:`,
        error,
      );
      // Re-throw ApiErrors (validation errors) to be handled by controller
      if (error instanceof ApiError) {
        throw error;
      }
      // For other errors, return empty result
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
    const totalRoi = await getAgentTotalRoi(sanitizedAgent.id);

    const agentRank = await getAgentRankById(sanitizedAgent.id);
    const rank = agentRank?.rank;
    const score = agentRank?.score;

    // Get trophies by reusing existing competition logic, filtered for ended competitions
    const endedCompetitions = await this.getCompetitionsForAgent(
      sanitizedAgent.id,
      { status: "ended", sort: "", limit: 10, offset: 0 }, // Filter + minimal paging defaults
      { sort: "-endDate", limit: 100, offset: 0 }, // Actual paging to override defaults
    );

    // Transform competition data to trophy format
    const trophies: AgentTrophy[] = endedCompetitions.competitions.map((comp) =>
      transformToTrophy({
        competitionId: comp.id,
        name: comp.name,
        rank: comp.bestPlacement?.rank,
        imageUrl: comp.imageUrl,
        endDate: comp.endDate,
        createdAt: comp.createdAt,
      }),
    );

    serviceLogger.debug(
      `[AgentManager] Generated ${trophies.length} trophies for agent ${sanitizedAgent.id}:`,
      trophies,
    );

    const stats = {
      completedCompetitions,
      totalVotes,
      totalTrades,
      bestPlacement,
      rank,
      score,
      totalRoi,
    } as AgentStats;

    return {
      ...sanitizedAgent,
      stats,
      trophies, // Now returns AgentTrophy[] instead of string[]
      skills: metadata?.skills || [],
      hasUnclaimedRewards: metadata?.hasUnclaimedRewards || false,
    };
  }

  /**
   * Attach agent metrics to multiple agents efficiently using bulk queries
   * This replaces the N+1 query pattern of calling attachAgentMetrics in a loop
   *
   * @param sanitizedAgents Array of sanitized agents to attach metrics to
   * @returns Array of agents with attached metrics
   */
  async attachBulkAgentMetrics(
    sanitizedAgents: ReturnType<AgentManager["sanitizeAgent"]>[],
  ) {
    if (sanitizedAgents.length === 0) {
      return [];
    }

    serviceLogger.debug(
      `[AgentManager] Attaching bulk metrics for ${sanitizedAgents.length} agents`,
    );

    try {
      // Get all metrics in bulk using optimized queries
      const agentIds = sanitizedAgents.map((agent) => agent.id);
      const bulkMetrics = await getBulkAgentMetrics(agentIds);

      // Create lookup maps for efficient access
      const metricsMap = new Map(
        bulkMetrics.map((metrics) => [metrics.agentId, metrics]),
      );

      // Get bulk trophies using optimized single query approach with error handling
      let trophiesMap = new Map();
      try {
        const bulkTrophies = await getBulkAgentTrophies(agentIds);
        trophiesMap = new Map(
          bulkTrophies.map((trophy) => [trophy.agentId, trophy.trophies]),
        );
      } catch (error) {
        serviceLogger.error(
          "[AgentManager] Error fetching bulk trophies:",
          error,
        );
        serviceLogger.error(
          "[AgentManager] Proceeding with empty trophies map",
        );
      }

      // Process agents synchronously with O(1) trophy lookups
      return sanitizedAgents.map((sanitizedAgent) => {
        const metadata = sanitizedAgent.metadata as AgentMetadata;
        const metrics = metricsMap.get(sanitizedAgent.id);
        const trophies = trophiesMap.get(sanitizedAgent.id) || [];

        serviceLogger.debug(
          `[AgentManager] Using bulk trophies: ${trophies.length} trophies for agent ${sanitizedAgent.id}`,
        );

        const stats = {
          completedCompetitions: metrics?.completedCompetitions ?? 0,
          totalVotes: metrics?.totalVotes ?? 0,
          totalTrades: metrics?.totalTrades ?? 0,
          bestPlacement: metrics?.bestPlacement ?? undefined,
          bestPnl: metrics?.bestPnl ?? undefined,
          rank: metrics?.globalRank ?? undefined,
          score: metrics?.globalScore ?? undefined,
          totalRoi: metrics?.totalRoi ?? null,
        } as AgentStats;

        return {
          ...sanitizedAgent,
          stats,
          trophies, // Use bulk-fetched database trophies
          skills: metadata?.skills || [],
          hasUnclaimedRewards: metadata?.hasUnclaimedRewards || false,
        };
      });
    } catch (error) {
      serviceLogger.error(
        "[AgentManager] Error in attachBulkAgentMetrics:",
        error,
      );

      // Fallback to individual queries if bulk fails
      serviceLogger.error(
        "[AgentManager] Falling back to individual metric queries",
      );
      return Promise.all(
        sanitizedAgents.map((agent) => this.attachAgentMetrics(agent)),
      );
    }
  }

  async getAgentPerformanceForComp(agentId: string, competitionId: string) {
    // Get oldest and newest snapshots for agent in competition
    const agentSnapshots = await getBoundedSnapshots(competitionId, agentId);
    const latestSnapshot = agentSnapshots?.newest; // Already ordered by timestamp desc
    const portfolioValue = latestSnapshot
      ? Number(latestSnapshot.totalValue)
      : 0;

    // Calculate PnL (similar to calculateAgentMetrics pattern)
    let pnl = 0;
    let pnlPercent = 0;
    let startingValue = 0;
    if (agentSnapshots) {
      startingValue = Number(agentSnapshots.oldest?.totalValue || 0);
      const currentValue = Number(agentSnapshots.newest?.totalValue || 0);
      pnl = currentValue - startingValue;
      pnlPercent = startingValue > 0 ? (pnl / startingValue) * 100 : 0;
    }

    return {
      portfolioValue,
      pnl,
      pnlPercent,
      startingValue,
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
      const { pnl, pnlPercent, portfolioValue } =
        await this.getAgentPerformanceForComp(agentId, competition.id);

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
      serviceLogger.error(
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
        bestPlacement: undefined, // No valid ranking data on error
      };
    }
  }

  /**
   * Sort competitions by computed fields
   * @param competitions Array of competitions with metrics and agents
   * @param sortString Sort string (e.g., "portfolioValue", "-pnl", "agentName,-createdAt")
   * @returns Sorted competitions array
   */
  private sortCompetitionsByComputedField(
    competitions: (EnhancedCompetition & { agents?: AgentPublic[] })[],
    sortString: string,
  ): (EnhancedCompetition & { agents?: AgentPublic[] })[] {
    const parts = sortString.split(",");
    if (parts.length === 0) return competitions;

    return competitions.sort((a, b) => {
      // Process each sort field in order
      for (const sortField of parts) {
        if (!sortField) continue;

        const isDesc = sortField.startsWith("-");
        const field = isDesc ? sortField.slice(1) : sortField;
        let comparison = 0;

        switch (field) {
          case "portfolioValue": {
            const aValue = a.portfolioValue || 0;
            const bValue = b.portfolioValue || 0;
            comparison = isDesc ? bValue - aValue : aValue - bValue;
            break;
          }
          case "pnl": {
            const aValue = a.pnl || 0;
            const bValue = b.pnl || 0;
            comparison = isDesc ? bValue - aValue : aValue - bValue;
            break;
          }
          case "totalTrades": {
            const aValue = a.totalTrades || 0;
            const bValue = b.totalTrades || 0;
            comparison = isDesc ? bValue - aValue : aValue - bValue;
            break;
          }
          case "rank": {
            // Handle undefined ranks: push to end of results
            const aAgent = a.agents?.[0];
            const bAgent = b.agents?.[0];
            const aRank =
              aAgent && "rank" in aAgent && typeof aAgent.rank === "number"
                ? aAgent.rank
                : undefined;
            const bRank =
              bAgent && "rank" in bAgent && typeof bAgent.rank === "number"
                ? bAgent.rank
                : undefined;

            if (aRank === undefined && bRank === undefined) {
              comparison = 0;
            } else if (aRank === undefined) {
              comparison = 1; // a goes to end
            } else if (bRank === undefined) {
              comparison = -1; // b goes to end
            } else {
              // For rank, lower is better (rank 1 > rank 2 > rank 3)
              comparison = isDesc ? bRank - aRank : aRank - bRank;
            }
            break;
          }
          case "agentHandle":
          case "agentName": {
            // Sort by the lexicographically FIRST agent name that belongs to the
            // authenticated user within each competition. This guarantees a
            // deterministic "primary" agent name irrespective of the order in
            // which agents were joined or returned from the database. Without
            // this, the primary agent could change between requests causing
            // flaky ordering in the UI and in automated tests.
            const primaryNameA =
              (a.agents?.length ?? 0) > 0
                ? (a.agents
                    ?.map((ag) => ag.name ?? "")
                    .sort((x, y) => x.localeCompare(y))[0] ?? "")
                : "";
            const primaryNameB =
              (b.agents?.length ?? 0) > 0
                ? (b.agents
                    ?.map((ag) => ag.name ?? "")
                    .sort((x, y) => x.localeCompare(y))[0] ?? "")
                : "";

            comparison = primaryNameA.localeCompare(primaryNameB);
            comparison = isDesc ? -comparison : comparison;
            break;
          }
          case "createdAt": {
            // Database field - sort by competition creation date
            const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
            comparison = isDesc
              ? bDate.getTime() - aDate.getTime()
              : aDate.getTime() - bDate.getTime();
            break;
          }
          case "startDate": {
            // Database field - sort by competition start date
            const aDate = a.startDate ? new Date(a.startDate) : new Date(0);
            const bDate = b.startDate ? new Date(b.startDate) : new Date(0);
            comparison = isDesc
              ? bDate.getTime() - aDate.getTime()
              : aDate.getTime() - bDate.getTime();
            break;
          }
          case "endDate": {
            // Database field - sort by competition end date
            const aDate = a.endDate ? new Date(a.endDate) : new Date(0);
            const bDate = b.endDate ? new Date(b.endDate) : new Date(0);
            comparison = isDesc
              ? bDate.getTime() - aDate.getTime()
              : aDate.getTime() - bDate.getTime();
            break;
          }
          case "name": {
            // Database field - sort by competition name
            const aName = a.name || "";
            const bName = b.name || "";
            comparison = aName.localeCompare(bName);
            comparison = isDesc ? -comparison : comparison;
            break;
          }
          case "status": {
            // Database field - sort by competition status
            const aStatus = a.status || "";
            const bStatus = b.status || "";
            comparison = aStatus.localeCompare(bStatus);
            comparison = isDesc ? -comparison : comparison;
            break;
          }
          default:
            comparison = 0;
        }

        // If this field produces a non-zero comparison, use it
        if (comparison !== 0) {
          return comparison;
        }
        // Otherwise, continue to the next sort field
      }

      // All fields were equal
      return 0;
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
        serviceLogger.error(
          "[AgentManager] Error recovering wallet address:",
          error,
        );
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
      serviceLogger.error(
        "[AgentManager] Error in verifyWalletOwnership:",
        error,
      );
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
      serviceLogger.error(
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
      serviceLogger.error("[AgentManager] Error generating nonce:", error);
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
      serviceLogger.error("[AgentManager] Error validating nonce:", error);
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
      serviceLogger.error(
        "[AgentManager] Error cleaning up expired nonces:",
        error,
      );
      return 0;
    }
  }

  /**
   * Create a new email verification token for an agent
   * @param agentId The ID of the agent to create a token for
   * @param expiresInHours How many hours until the token expires (default: 24)
   * @returns The created token string
   */
  private async createEmailVerificationToken(
    agentId: string,
    expiresInHours: number = 24,
  ): Promise<string> {
    try {
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      await createEmailVerificationToken({
        id: uuidv4(),
        agentId,
        token,
        expiresAt,
      });

      serviceLogger.debug(
        `[AgentManager] Created email verification token for agent ${agentId}`,
      );
      return token;
    } catch (error) {
      serviceLogger.error(
        `[AgentManager] Error creating email verification token for agent ${agentId}:`,
        error,
      );
      throw new Error(
        `Failed to create email verification token: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Send an email verification link to an agent
   * @param agent The agent to send the verification email to
   * @returns The created email verification token
   */
  private async sendEmailVerification(agent: SelectAgent): Promise<void> {
    try {
      if (!agent.email) {
        serviceLogger.warn(
          `[AgentManager] Cannot send verification email: Agent ${agent.id} has no email address`,
        );
        return;
      }

      const tokenString = await this.createEmailVerificationToken(agent.id, 24);

      await this.emailService.sendTransactionalEmail(agent.email, tokenString);

      serviceLogger.debug(
        `[AgentManager] Sent verification email to ${agent.email} for agent ${agent.id}`,
      );
    } catch (error) {
      serviceLogger.error(
        `[AgentManager] Error sending verification email to agent ${agent.id}:`,
        error,
      );
      // We don't throw here to prevent registration failure if email sending fails
    }
  }

  /**
   * Mark an agent's email as verified
   * @param agentId The ID of the agent to update
   * @returns The updated agent or undefined if not found
   */
  async markEmailAsVerified(agentId: string): Promise<SelectAgent | undefined> {
    try {
      serviceLogger.debug(
        `[AgentManager] Marking email as verified for agent ${agentId}`,
      );

      // Update the agent with email verified flag
      const updatedAgent = await update({
        id: agentId,
        isEmailVerified: true,
      });

      if (!updatedAgent) {
        serviceLogger.debug(
          `[AgentManager] Failed to update email verification status for agent: ${agentId}`,
        );
        return undefined;
      }

      serviceLogger.debug(
        `[AgentManager] Successfully marked email as verified for agent: ${agentId}`,
      );
      return updatedAgent;
    } catch (error) {
      serviceLogger.error(
        `[AgentManager] Error marking email as verified for agent ${agentId}:`,
        error,
      );
      throw new Error(
        `Failed to mark email as verified: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
