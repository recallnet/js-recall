import * as crypto from "crypto";
import { DatabaseError } from "pg";
import { Logger } from "pino";
import { generateNonce } from "siwe";
import { recoverMessageAddress } from "viem";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  InsertAgent,
  SelectAgent,
  SelectCompetition,
} from "@recallnet/db/schema/core/types";
import type {
  SelectBalance,
  SelectPerpsRiskMetrics,
} from "@recallnet/db/schema/trading/types";

import { AgentMetricsHelper } from "./agent-metrics-helper.js";
import { BalanceService } from "./balance.service.js";
import { EmailService } from "./email.service.js";
import { decryptApiKey, hashApiKey } from "./lib/api-key-utils.js";
import { generateHandleFromName } from "./lib/handle-utils.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import type { AgentWithMetrics } from "./types/agent-metrics.js";
import { ApiError } from "./types/index.js";
import {
  AgentCompetitionsFilters,
  AgentCompetitionsParams,
  AgentMetadata,
  AgentPublic,
  AgentPublicSchema,
  AgentSearchParams,
  ApiAuth,
  EnhancedCompetition,
  PagingParams,
  PagingParamsSchema,
} from "./types/index.js";
import { AgentQueryParams } from "./types/sort/agent.js";
import type { UserService } from "./user.service.js";

/**
 * Enhanced balance with price data and chain information
 * Extends the base balance with additional computed fields
 */
export interface EnhancedBalance extends SelectBalance {
  chain: string;
  price?: number;
  value?: number;
}

export interface AgentServiceConfig {
  security: {
    rootEncryptionKey: string;
  };
  api: {
    domain: string;
  };
}

/**
 * Agent Service
 * Manages agent registration and API key authentication
 */
export class AgentService {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, ApiAuth>;
  // Cache for inactive agents to avoid repeated database lookups
  private inactiveAgentsCache: Map<string, { reason: string; date: Date }>;
  // Email service for sending verification emails
  private emailService: EmailService;
  // Balance service for managing agent balances
  private balanceService: BalanceService;
  // Price tracker service for getting token prices
  private priceTrackerService: PriceTrackerService;
  // User service for validating user existence
  private userService: UserService;

  private agentRepository: AgentRepository;
  private agentNonceRepository: AgentNonceRepository;
  private competitionRepository: CompetitionRepository;
  private leaderboardRepository: LeaderboardRepository;
  private perpsRepository: PerpsRepository;
  private tradeRepository: TradeRepository;
  private userRepository: UserRepository;

  private rootEncryptionKey: string;

  private apiDomain: string;

  private logger: Logger;

  constructor(
    emailService: EmailService,
    balanceService: BalanceService,
    priceTrackerService: PriceTrackerService,
    userService: UserService,
    agentRepository: AgentRepository,
    agentNonceRepository: AgentNonceRepository,
    competitionRepository: CompetitionRepository,
    leaderboardRepository: LeaderboardRepository,
    perpsRepository: PerpsRepository,
    tradeRepository: TradeRepository,
    userRepository: UserRepository,
    config: AgentServiceConfig,
    logger: Logger,
  ) {
    this.apiKeyCache = new Map();
    this.inactiveAgentsCache = new Map();
    this.emailService = emailService;
    this.balanceService = balanceService;
    this.priceTrackerService = priceTrackerService;
    this.userService = userService;
    this.agentRepository = agentRepository;
    this.agentNonceRepository = agentNonceRepository;
    this.competitionRepository = competitionRepository;
    this.leaderboardRepository = leaderboardRepository;
    this.perpsRepository = perpsRepository;
    this.tradeRepository = tradeRepository;
    this.userRepository = userRepository;
    this.rootEncryptionKey = config.security.rootEncryptionKey;
    this.apiDomain = config.api.domain;
    this.logger = logger;
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
   * @returns The created agent with unencrypted API credentials for display to admin
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
  }): Promise<SelectAgent> {
    try {
      // Validate that the user exists
      const user = await this.userService.getUser(ownerId);
      if (!user) {
        throw new ApiError(404, `User '${ownerId}' does not exist`);
      }

      // Validate wallet address if provided
      if (walletAddress && !this.isValidEthereumAddress(walletAddress)) {
        throw new ApiError(
          400,
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }

      // Generate agent ID
      const id = crypto.randomUUID();

      // Generate API key (longer, more secure format)
      const apiKey = this.generateApiKey();

      // Encrypt API key for storage
      const encryptedApiKey = this.encryptApiKey(apiKey);

      // Generate hash for fast lookups
      const apiKeyHash = hashApiKey(apiKey);

      // Create agent record
      const agent: InsertAgent = {
        id,
        ownerId,
        name,
        handle,
        description,
        imageUrl,
        apiKey: encryptedApiKey, // Store encrypted key in database
        apiKeyHash, // Store hash for fast lookups
        walletAddress,
        metadata,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      let savedAgent;
      try {
        savedAgent = await this.agentRepository.create(agent);
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

      this.logger.debug(
        `[AgentManager] Created agent: ${name} (${id}) for owner ${ownerId}`,
      );

      // Return agent with unencrypted apiKey for display to admin
      return {
        ...savedAgent,
        apiKey, // Return unencrypted key
      };
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error creating agent");
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(
        `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a new agent for an owner identified by either user ID or wallet address.
   * If the owner is not provided, the agent will be created for the user with the provided wallet address.
   * @param ownerIdentifier Object containing either userId or walletAddress
   * @param agentData Agent creation data
   * @returns The created agent with unencrypted API key
   * @throws {ApiError} With appropriate HTTP status code and message
   */
  async createAgentForOwner(
    ownerIdentifier: { userId?: string; walletAddress?: string },
    agentData: {
      name: string;
      handle?: string;
      description?: string;
      imageUrl?: string;
      metadata?: AgentMetadata;
      email?: string;
      walletAddress?: string;
    },
  ): Promise<SelectAgent> {
    // Resolve owner identifier to user ID
    let ownerId: string;
    if (ownerIdentifier.userId) {
      ownerId = ownerIdentifier.userId;
    } else if (ownerIdentifier.walletAddress) {
      const user = await this.userService.getUserByWalletAddress(
        ownerIdentifier.walletAddress,
      );
      if (!user) {
        throw new ApiError(
          404,
          `User with wallet address '${ownerIdentifier.walletAddress}' does not exist`,
        );
      }
      ownerId = user.id;
    } else {
      throw new ApiError(400, "Must provide either user ID or wallet address");
    }

    return this.createAgent({
      ownerId,
      name: agentData.name,
      handle: agentData.handle || generateHandleFromName(agentData.name),
      description: agentData.description,
      imageUrl: agentData.imageUrl,
      metadata: agentData.metadata,
      email: agentData.email,
      walletAddress: agentData.walletAddress,
    });
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
      return await this.agentRepository.findById(agentId);
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving agent ${agentId}`,
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
      return await this.agentRepository.findByOwnerId(ownerId, pagingParams);
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving agents for owner ${ownerId}`,
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
      const bestPlacement =
        await this.competitionRepository.findBestPlacementForAgent(agentId);
      if (!bestPlacement) {
        return null;
      }
      return bestPlacement;
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving agent rank for ${agentId}`,
      );
      return null;
    }
  }

  /**
   * Get multiple agents by their IDs
   * @param agentIds Array of agent IDs to retrieve
   * @returns Array of agents matching the provided IDs
   */
  async getAgentsByIds(agentIds: string[]) {
    try {
      if (agentIds.length === 0) {
        return [];
      }
      return await this.agentRepository.findByIds(agentIds);
    } catch (error) {
      this.logger.error(
        { error },
        "[AgentManager] Error retrieving agents by IDs",
      );
      return [];
    }
  }

  /**
   * Check if an API key is cached and validate the agent status
   * @private
   */
  private checkCachedApiKey(apiKey: string): string | null {
    const cachedAuth = this.apiKeyCache.get(apiKey);
    if (!cachedAuth) {
      return null;
    }

    // Check if the agent is inactive
    if (this.inactiveAgentsCache.has(cachedAuth.agentId)) {
      const deactivationInfo = this.inactiveAgentsCache.get(cachedAuth.agentId);
      throw new Error(
        `Your agent has been deactivated from the competition: ${deactivationInfo?.reason}`,
      );
    }

    return cachedAuth.agentId;
  }

  /**
   * Validate agent status and update caches
   * @private
   */
  private validateAgentStatus(agent: SelectAgent, apiKey: string): void {
    // Check if globally suspended/deleted
    // Note: We now allow "inactive" agents to authenticate for non-competition operations
    if (agent.status === "suspended" || agent.status === "deleted") {
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
      const cachedAgentId = this.checkCachedApiKey(apiKey);
      if (cachedAgentId) {
        return cachedAgentId;
      }

      // Use hash-based lookup for O(1) performance
      const apiKeyHash = hashApiKey(apiKey);
      const agent = await this.agentRepository.findByApiKeyHash(apiKeyHash);

      if (!agent) {
        return null;
      }

      // Validate agent status and update caches
      this.validateAgentStatus(agent, apiKey);

      return agent.id;
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error validating API key");
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
    this.logger.debug(
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
      this.logger.debug(
        `[AgentManager] Encrypting API key with length: ${key.length}`,
      );
      const algorithm = "aes-256-cbc";
      const iv = crypto.randomBytes(16);

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(this.rootEncryptionKey))
        .digest();

      const cipher = crypto.createCipheriv(algorithm, cryptoKey, iv);
      let encrypted = cipher.update(key, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return the IV and encrypted data together, clearly separated
      const result = `${iv.toString("hex")}:${encrypted}`;
      this.logger.debug(
        `[AgentManager] Encrypted key length: ${result.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error encrypting API key");
      throw new Error("Failed to encrypt API key");
    }
  }

  /**
   * Get a decrypted API key for a specific agent
   * This is intended only for admin access to help users that have lost their API keys
   * @param agentId ID of the agent whose API key should be retrieved
   * @returns Object with the decrypted API key and agent details
   * @throws {ApiError} 404 if agent not found
   * @throws {ApiError} 500 if decryption fails
   */
  public async getDecryptedApiKeyById(agentId: string): Promise<{
    apiKey: string;
    agent: {
      id: string;
      name: string;
      ownerId: string;
    };
  }> {
    // Get the agent
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new ApiError(404, "Agent not found");
    }

    try {
      // Decrypt the API key using shared utility
      const apiKey = decryptApiKey(
        agent.apiKey,
        String(this.rootEncryptionKey),
      );

      // Audit log for security tracking
      this.logger.debug(
        `[AUDIT] User ${agent.ownerId} accessed API key for agent ${agentId}`,
      );

      return {
        apiKey,
        agent: {
          id: agent.id,
          name: agent.name,
          ownerId: agent.ownerId,
        },
      };
    } catch (decryptError) {
      this.logger.error(
        { error: decryptError },
        `[AgentManager] Error decrypting API key for agent ${agentId}`,
      );
      throw new ApiError(500, "Failed to decrypt API key");
    }
  }

  /**
   * Check if the system is healthy
   */
  async isHealthy() {
    try {
      const res = await this.agentRepository.count();
      return res >= 0;
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Health check failed");
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
      const agent = await this.agentRepository.findById(agentId);

      if (!agent) {
        this.logger.debug(
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
      const deleted = await this.agentRepository.deleteAgent(agentId);

      if (deleted) {
        this.logger.debug(
          `[AgentManager] Successfully deleted agent: ${agent.name} (${agentId})`,
        );
      } else {
        this.logger.debug(
          `[AgentManager] Failed to delete agent: ${agent.name} (${agentId})`,
        );
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error deleting agent ${agentId}`,
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
      this.logger.debug(
        `[AgentManager] Deactivating agent: ${agentId}, Reason: ${reason}`,
      );

      // Call repository to deactivate the agent
      const deactivatedAgent = await this.agentRepository.deactivateAgent(
        agentId,
        reason,
      );

      if (!deactivatedAgent) {
        this.logger.debug(
          `[AgentManager] Agent not found for deactivation: ${agentId}`,
        );
        return null;
      }

      // Update deactivation cache
      this.inactiveAgentsCache.set(agentId, {
        reason: reason,
        date: deactivatedAgent.deactivationDate || new Date(),
      });

      this.logger.debug(
        `[AgentManager] Successfully deactivated agent: ${deactivatedAgent.name} (${agentId})`,
      );

      return deactivatedAgent;
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error deactivating agent ${agentId}`,
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
      this.logger.debug(`[AgentManager] Reactivating agent: ${agentId}`);

      // Call repository to reactivate the agent
      const reactivatedAgent =
        await this.agentRepository.reactivateAgent(agentId);

      if (!reactivatedAgent) {
        this.logger.debug(
          `[AgentManager] Agent not found for reactivation: ${agentId}`,
        );
        return null;
      }

      // Remove from inactive cache
      this.inactiveAgentsCache.delete(agentId);

      this.logger.debug(
        `[AgentManager] Successfully reactivated agent: ${reactivatedAgent.name} (${agentId})`,
      );

      return reactivatedAgent;
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error reactivating agent ${agentId}`,
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
      this.logger.debug(
        `[AgentManager] Updating agent: ${agent.id} (${agent.name})`,
      );

      // Check if agent exists
      const existingAgent = await this.agentRepository.findById(agent.id);
      if (!existingAgent) {
        this.logger.debug(
          `[AgentManager] Agent not found for update: ${agent.id}`,
        );
        return undefined;
      }

      // Always set updated timestamp
      agent.updatedAt = new Date();

      // Save to database
      let updatedAgent;
      try {
        updatedAgent = await this.agentRepository.update(agent);
        if (!updatedAgent) {
          this.logger.debug(
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

      this.logger.debug(
        `[AgentManager] Successfully updated agent: ${updatedAgent.name} (${agent.id})`,
      );
      return updatedAgent;
    } catch (error) {
      // Re-throw ApiError instances directly
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        { error },
        `[AgentManager] Error updating agent ${agent.id}`,
      );
      throw new Error(
        `Failed to update agent: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Reset an agent's API key
   * @param agentId The agent ID
   * @returns Object with new API key (unencrypted for display) and updated agent
   */
  async resetApiKey(agentId: string) {
    try {
      this.logger.debug(
        `[AgentManager] Resetting API key for agent: ${agentId}`,
      );

      // Get the agent
      const agent = await this.agentRepository.findById(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      // Generate a new API key
      const newApiKey = this.generateApiKey();

      // Encrypt the new API key for storage
      const encryptedApiKey = this.encryptApiKey(newApiKey);

      // Generate hash for fast lookups
      const apiKeyHash = hashApiKey(newApiKey);

      // Update the agent with the new encrypted API key and hash
      agent.apiKey = encryptedApiKey;
      agent.apiKeyHash = apiKeyHash;
      agent.updatedAt = new Date();

      // Save the updated agent to the database
      const updatedAgent = await this.agentRepository.update(agent);
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

      this.logger.debug(
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
      this.logger.error(
        { error },
        `[AgentManager] Error resetting API key for agent ${agentId}`,
      );
      throw error;
    }
  }

  /**
   * Search for agents based on various attributes
   * @param searchParams Parameters to search by (name, ownerId, status)
   * @returns Array of agents matching the search criteria
   */
  async searchAgents(searchParams: AgentSearchParams): Promise<AgentPublic[]> {
    try {
      this.logger.debug(
        { searchParams },
        `[AgentManager] Searching for agents with params:`,
      );

      // Get matching agents from repository
      const agents = await this.agentRepository.searchAgents(searchParams);

      this.logger.debug(
        `[AgentManager] Found ${agents.length} agents matching search criteria`,
      );
      return agents.map(this.sanitizeAgent.bind(this));
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error searching agents");
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
      this.logger.debug(
        { params },
        `[AgentManager] Retrieving agents for competition ${competitionId} with params:`,
      );

      // Get agents from repository
      const { agents, total } = await this.agentRepository.findByCompetition(
        competitionId,
        params,
      );

      this.logger.debug(
        `[AgentManager] Found ${agents.length} agents for competition ${competitionId}`,
      );
      return { agents, total };
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving agents for competition ${competitionId}`,
      );
      return { agents: [], total: 0 };
    }
  }

  /**
   * Get competitions for a specific agent
   * @param agentId Agent ID
   * @param filters Filter parameters (status, claimed)
   * @param paging Pagination parameters (limit, offset, sort)
   * @returns Object containing competitions array and total count
   */
  async getCompetitionsForAgent(
    agentId: string,
    filters: AgentCompetitionsFilters,
    paging: PagingParams,
  ) {
    try {
      // Combine filters and paging for repository call
      const params = {
        ...filters,
        ...paging,
      };
      this.logger.debug(
        { params },
        `[AgentManager] Retrieving competitions for agent ${agentId} with params:`,
      );

      // Get competitions from repository
      const results = await this.agentRepository.findAgentCompetitions(
        agentId,
        params,
      );

      // Filter out null competitions and ensure required fields are present
      const validCompetitions = results.competitions.filter(
        (comp) => comp !== null,
      ) as SelectCompetition[];

      // Attach metrics to all competitions in bulk
      const enhancedCompetitions = await this.attachBulkCompetitionMetrics(
        validCompetitions,
        agentId,
      );

      // Handle computed field sorting if needed
      let finalCompetitions = enhancedCompetitions;
      if (results.isComputedSort && params.sort) {
        finalCompetitions = this.sortCompetitionsByComputedField(
          enhancedCompetitions,
          params.sort,
        );

        // Apply pagination for computed sorting
        const startIndex = params.offset || 0;
        const endIndex = startIndex + (params.limit || 10);
        finalCompetitions = finalCompetitions.slice(startIndex, endIndex);
      }

      this.logger.debug(
        `[AgentManager] Found ${results.total} competitions for agent ${agentId}`,
      );
      return {
        competitions: finalCompetitions,
        total: results.total,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving competitions for agent ${agentId}`,
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
      this.logger.debug(
        { params },
        `[AgentManager] Retrieving competitions for user ${userId} agents with params:`,
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
        this.logger.debug(`[AgentManager] User ${userId} has no agents`);
        return { competitions: [], total: 0 };
      }

      // Combine validated pagination with other parameters
      const competitionParams = {
        ...params, // Keep business fields (status, claimed, etc.)
        ...validatedParams, // Use validated pagination (sort, limit, offset)
      };

      // Use optimized repository method that handles both database and computed sorting efficiently
      const results = await this.agentRepository.findUserAgentCompetitions(
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
            // TODO: here we have a lookup that happens if we need computed
            // sort and inside a loop over all competitions and if we need
            // a "RankFallback". We might want to refactor this logic.
            const bulkRankings =
              await this.competitionRepository.getBulkAgentCompetitionRankings(
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
          const bulkRankings =
            await this.competitionRepository.getBulkAgentCompetitionRankings(
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

      this.logger.debug(
        `[AgentManager] Found ${results.total} competitions containing agents owned by user ${userId}`,
      );

      // Return competitions in the original sorted order
      const sortedCompetitions = competitionOrder.map((id) =>
        agentCompetitions.get(id),
      );

      return {
        competitions: sortedCompetitions,
        total: results.total,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error retrieving competitions for user ${userId} agents`,
      );
      // Re-throw ApiErrors (validation errors) to be handled by controller
      if (error instanceof ApiError) {
        throw error;
      }
      // For other errors, return empty result
      // TODO: we might want to start throwing 500 when something unexpected
      // happens.
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
  }): Promise<SelectAgent[]> {
    if (filter && /^0x[a-fA-F0-9]{40}$/.test(filter)) {
      return this.agentRepository.findByWallet({
        walletAddress: filter,
        pagingParams,
      });
    }
    if (filter && filter.length > 0) {
      return this.agentRepository.findByName({ name: filter, pagingParams });
    }

    return this.agentRepository.findAll(pagingParams);
  }

  /**
   * Count agents with optional filter
   * @param filter Filter by wallet address or name
   * @returns Number of agents matching the filter
   */
  async countAgents(filter?: string) {
    if (filter && /^0x[a-fA-F0-9]{40}$/.test(filter)) {
      return this.agentRepository.countByWallet(filter);
    }
    if (filter && filter.length > 0) {
      return this.agentRepository.countByName(filter);
    }

    return this.agentRepository.count();
  }

  /**
   * Sanitize an agent object for public display
   * @param agent The agent object to sanitize
   * @returns The sanitized agent object
   */
  sanitizeAgent(agent: SelectAgent): AgentPublic {
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
    sanitizedAgent: AgentPublic,
  ): Promise<AgentWithMetrics> {
    this.logger.debug(
      `[AgentManager] Attaching metrics for single agent ${sanitizedAgent.id}`,
    );

    // Delegate to bulk method for consistency and to avoid code duplication
    const results = await this.attachBulkAgentMetrics([sanitizedAgent]);

    // This should never happen since we pass exactly one agent, but TypeScript needs the check
    if (!results[0]) {
      throw new Error(
        `Failed to attach metrics for agent ${sanitizedAgent.id}`,
      );
    }

    return results[0];
  }

  /**
   * Attach agent metrics to multiple agents efficiently using bulk queries
   *
   * @param sanitizedAgents Array of sanitized agents to attach metrics to
   * @returns Array of agents with attached metrics
   */
  async attachBulkAgentMetrics(
    sanitizedAgents: AgentPublic[],
  ): Promise<AgentWithMetrics[]> {
    if (sanitizedAgents.length === 0) {
      return [];
    }

    this.logger.debug(
      `[AgentManager] Attaching bulk metrics for ${sanitizedAgents.length} agents`,
    );

    try {
      const agentIds = sanitizedAgents.map((agent) => agent.id);

      // Get raw metrics and trophies in parallel
      const [rawMetrics, bulkTrophies] = await Promise.all([
        this.leaderboardRepository.getBulkAgentMetrics(agentIds),
        this.agentRepository.getBulkAgentTrophies(agentIds),
      ]);

      // Transform raw metrics using the helper
      const metricsArray = AgentMetricsHelper.transformRawMetricsToAgentMetrics(
        agentIds,
        rawMetrics,
      );

      // Create lookup maps for efficient access
      const metricsMap = new Map(
        metricsArray.map((metrics) => [metrics.agentId, metrics]),
      );
      const trophiesMap = new Map(
        bulkTrophies.map((trophy) => [trophy.agentId, trophy.trophies]),
      );

      // Process agents using helper
      return sanitizedAgents.map((agent) => {
        const metrics =
          metricsMap.get(agent.id) ||
          AgentMetricsHelper.createEmptyMetrics(agent.id);
        const trophies = trophiesMap.get(agent.id) || [];

        this.logger.debug(
          `[AgentManager] Using bulk trophies: ${trophies.length} trophies for agent ${agent.id}`,
        );

        return AgentMetricsHelper.attachMetricsToAgent(
          agent,
          metrics,
          trophies,
        );
      });
    } catch (error) {
      this.logger.error(
        { error },
        "[AgentManager] Error in attachBulkAgentMetrics",
      );

      throw error;
    }
  }

  async getAgentPerformanceForComp(agentId: string, competitionId: string) {
    // Get oldest and newest snapshots for agent in competition
    const agentSnapshots = await this.competitionRepository.getBoundedSnapshots(
      competitionId,
      agentId,
    );
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
   * Attach agent-specific metrics to multiple competitions in bulk
   * @param competitions Array of competitions to enhance
   * @param agentId Agent ID
   * @returns Array of enhanced competitions with metrics
   */
  async attachBulkCompetitionMetrics(
    competitions: SelectCompetition[],
    agentId: string,
  ): Promise<EnhancedCompetition[]> {
    if (competitions.length === 0) {
      return [];
    }

    try {
      const competitionIds = competitions.map((comp) => comp.id);

      // Separate competitions by type for optimized queries
      const paperTradingCompetitions = competitions.filter(
        (comp) => comp.type === "trading",
      );
      const perpsCompetitions = competitions.filter(
        (comp) => comp.type === "perpetual_futures",
      );

      const paperTradingIds = paperTradingCompetitions.map((comp) => comp.id);
      const perpsIds = perpsCompetitions.map((comp) => comp.id);

      // Fetch data in parallel - only fetch what's needed for each type
      const [
        snapshotsMap,
        tradeCountsMap,
        positionCountsMap,
        rankingsMap,
        riskMetricsMap,
      ] = await Promise.all([
        this.competitionRepository.getBulkBoundedSnapshots(
          agentId,
          competitionIds,
        ),
        paperTradingIds.length > 0
          ? this.tradeRepository.countBulkAgentTradesInCompetitions(
              agentId,
              paperTradingIds,
            )
          : Promise.resolve(new Map<string, number>()),
        perpsIds.length > 0
          ? this.perpsRepository.countBulkAgentPositionsInCompetitions(
              agentId,
              perpsIds,
            )
          : Promise.resolve(new Map<string, number>()),
        this.competitionRepository.getAgentRankingsInCompetitions(
          agentId,
          competitionIds,
        ),
        perpsIds.length > 0
          ? this.perpsRepository.getBulkAgentRiskMetrics(agentId, perpsIds)
          : Promise.resolve(new Map<string, SelectPerpsRiskMetrics>()),
      ]);

      // Map results back to competitions with type-aware metrics
      return competitions.map((competition) => {
        const snapshots = snapshotsMap.get(competition.id);
        const bestPlacement = rankingsMap.get(competition.id);

        // Calculate PnL from snapshots (works for both types)
        let portfolioValue = 0;
        let pnl = 0;
        let pnlPercent = 0;

        if (snapshots) {
          portfolioValue = Number(snapshots.newest?.totalValue || 0);
          const startingValue = Number(snapshots.oldest?.totalValue || 0);
          pnl = portfolioValue - startingValue;
          pnlPercent = startingValue > 0 ? (pnl / startingValue) * 100 : 0;
        }

        // Build response with appropriate metrics based on competition type
        const baseMetrics = {
          ...competition,
          portfolioValue,
          pnl,
          pnlPercent,
          bestPlacement,
          competitionType: competition.type, // Always include type for client awareness
        };

        // Add type-specific metrics
        if (competition.type === "perpetual_futures") {
          const riskMetrics = riskMetricsMap.get(competition.id);
          return {
            ...baseMetrics,
            totalPositions: positionCountsMap.get(competition.id) || 0,
            totalTrades: 0, // Not applicable for perps, but include for consistency
            // Include risk metrics if available
            calmarRatio: riskMetrics ? Number(riskMetrics.calmarRatio) : null,
            simpleReturn: riskMetrics ? Number(riskMetrics.simpleReturn) : null,
            maxDrawdown: riskMetrics ? Number(riskMetrics.maxDrawdown) : null,
            hasRiskMetrics: !!riskMetrics,
          };
        } else {
          return {
            ...baseMetrics,
            totalTrades: tradeCountsMap.get(competition.id) || 0,
            totalPositions: 0, // Not applicable for paper trading, but include for consistency
            // Risk metrics not applicable for paper trading
            calmarRatio: null,
            simpleReturn: null,
            maxDrawdown: null,
            hasRiskMetrics: false,
          };
        }
      });
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error attaching bulk competition metrics for agent ${agentId}`,
      );
      throw error;
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
          case "totalPositions": {
            const aValue = a.totalPositions || 0;
            const bValue = b.totalPositions || 0;
            comparison = isDesc ? bValue - aValue : aValue - bValue;
            break;
          }
          case "bestPlacement": {
            // Note: `undefined` bestPlacement is pushed to the end (e.g., pending comps or DQ'd)
            const aRank =
              typeof a.bestPlacement?.rank === "number"
                ? a.bestPlacement.rank
                : undefined;
            const bRank =
              typeof b.bestPlacement?.rank === "number"
                ? b.bestPlacement.rank
                : undefined;
            if (aRank === undefined && bRank === undefined) {
              comparison = 0;
            } else if (aRank === undefined) {
              // For ascending, undefined goes last; for descending, undefined goes first
              comparison = isDesc ? -1 : 1;
            } else if (bRank === undefined) {
              comparison = isDesc ? 1 : -1;
            } else {
              comparison = isDesc ? bRank - aRank : aRank - bRank;
            }
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
  ): Promise<string> {
    try {
      // Parse custom message format
      const { timestamp, domain, purpose, nonce } =
        this.parseVerificationMessage(message);

      // Validate message content using config
      if (domain !== this.apiDomain) {
        throw new ApiError(400, "Invalid domain");
      }

      if (purpose !== "WALLET_VERIFICATION") {
        throw new ApiError(400, "Invalid purpose");
      }

      // Validate timestamp (5-minute window with clock skew tolerance)
      const timestampDate = new Date(timestamp);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const clockSkewTolerance = new Date(now.getTime() + 30 * 1000); // 30 second tolerance for clock skew

      if (timestampDate < fiveMinutesAgo) {
        throw new ApiError(400, "Message timestamp too old");
      }

      if (timestampDate > clockSkewTolerance) {
        throw new ApiError(400, "Message timestamp too far in the future");
      }

      // Validate and consume nonce (now required)
      await this.validateAndConsumeNonce(agentId, nonce);

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
        this.logger.error(
          { error },
          "[AgentManager] Error recovering wallet address",
        );
        throw new ApiError(400, "Invalid signature");
      }

      // Check cross-table uniqueness
      const existingUser =
        await this.userRepository.findByWalletAddress(walletAddress);
      if (existingUser) {
        throw new ApiError(
          409,
          "Wallet address already associated with a user account",
        );
      }

      const existingAgents = await this.agentRepository.findByWallet({
        walletAddress,
        pagingParams: { limit: 1, offset: 0, sort: "createdAt" },
      });
      const existingAgent = existingAgents[0];
      if (existingAgent && existingAgent.id !== agentId) {
        throw new ApiError(
          409,
          "Wallet address already associated with another agent",
        );
      }

      // Get and update agent wallet address
      const agent = await this.getAgent(agentId);
      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      const updatedAgent = await this.updateAgent({
        ...agent,
        walletAddress,
      });

      if (!updatedAgent) {
        throw new ApiError(500, "Failed to update agent wallet address");
      }

      return walletAddress;
    } catch (error) {
      this.logger.error(
        { error },
        "[AgentManager] Error in verifyWalletOwnership",
      );
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Verification failed");
    }
  }

  /**
   * Parse custom verification message format
   */
  private parseVerificationMessage(message: string): {
    timestamp: string;
    domain: string;
    purpose: string;
    nonce: string;
  } {
    try {
      const lines = message.trim().split("\n");

      if (lines[0] !== "VERIFY_WALLET_OWNERSHIP") {
        throw new ApiError(400, "Invalid message header");
      }

      const timestampLine = lines.find((line) =>
        line.startsWith("Timestamp: "),
      );
      const domainLine = lines.find((line) => line.startsWith("Domain: "));
      const purposeLine = lines.find((line) => line.startsWith("Purpose: "));
      const nonceLine = lines.find((line) => line.startsWith("Nonce: "));

      if (!timestampLine || !domainLine || !purposeLine) {
        throw new ApiError(400, "Missing required message fields");
      }

      if (!nonceLine) {
        throw new ApiError(400, "Nonce is required");
      }

      const timestamp = timestampLine.replace("Timestamp: ", "");
      const domain = domainLine.replace("Domain: ", "");
      const purpose = purposeLine.replace("Purpose: ", "");
      const nonce = nonceLine.replace("Nonce: ", "");

      return {
        timestamp,
        domain,
        purpose,
        nonce,
      };
    } catch (error) {
      this.logger.error(
        { error },
        "[AgentManager] Error parsing verification message",
      );
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(400, "Failed to parse message");
    }
  }

  /**
   * Generate a nonce for agent wallet verification
   * @param agentId The agent ID requesting a nonce
   * @returns Generated nonce
   */
  async generateNonceForAgent(agentId: string): Promise<string> {
    try {
      // Generate a cryptographically secure nonce
      const nonce = generateNonce();

      // Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Clean up any existing nonces for this agent to keep table clean
      await this.agentNonceRepository.deleteByAgentId(agentId);

      // Store in database
      await this.agentNonceRepository.create({
        id: crypto.randomUUID(),
        agentId,
        nonce,
        expiresAt,
      });

      return nonce;
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error generating nonce");
      throw new ApiError(500, "Failed to generate nonce");
    }
  }

  /**
   * Validate and consume a nonce for agent wallet verification
   * @param agentId The agent ID using the nonce
   * @param nonce The nonce to validate and consume
   */
  async validateAndConsumeNonce(agentId: string, nonce: string): Promise<void> {
    try {
      // Find the nonce
      const nonceRecord = await this.agentNonceRepository.findByNonce(nonce);

      if (!nonceRecord) {
        throw new ApiError(400, "Invalid nonce");
      }

      // Check if nonce belongs to the agent
      if (nonceRecord.agentId !== agentId) {
        throw new ApiError(400, "Nonce does not belong to this agent");
      }

      // Check if nonce is already used
      if (nonceRecord.usedAt) {
        throw new ApiError(400, "Nonce already used");
      }

      // Check if nonce is expired
      if (new Date() > nonceRecord.expiresAt) {
        throw new ApiError(400, "Nonce expired");
      }

      // Mark nonce as used
      await this.agentNonceRepository.markAsUsed(nonce);
    } catch (error) {
      this.logger.error({ error }, "[AgentManager] Error validating nonce");
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to validate nonce");
    }
  }

  /**
   * Clean up expired nonces (can be called by a background job)
   * @returns Number of cleaned up nonces
   */
  async cleanupExpiredNonces(): Promise<number> {
    try {
      return await this.agentNonceRepository.deleteExpired();
    } catch (error) {
      this.logger.error(
        { error },
        "[AgentManager] Error cleaning up expired nonces",
      );
      return 0;
    }
  }

  /**
   * Get enhanced balances for an agent with price data and chain information
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @returns Array of balances enhanced with price data, chain info, and values
   */
  async getEnhancedBalances(
    agentId: string,
    competitionId: string,
  ): Promise<EnhancedBalance[]> {
    try {
      // Get all balances for the agent
      const balances = await this.balanceService.getAllBalances(
        agentId,
        competitionId,
      );

      // Extract all unique token addresses
      const tokenAddresses = balances.map((b) => b.tokenAddress);

      // Get all prices in bulk
      const priceMap =
        await this.priceTrackerService.getBulkPrices(tokenAddresses);

      // Enhance balances with the price data
      const enhancedBalances = balances.map((balance) => {
        const priceReport = priceMap.get(balance.tokenAddress);

        if (priceReport) {
          return {
            ...balance,
            chain: priceReport.chain,
            price: priceReport.price,
            value: balance.amount * priceReport.price,
            specificChain: priceReport.specificChain || balance.specificChain,
            symbol: priceReport.symbol || balance.symbol,
          };
        }

        // Fallback for tokens without price data
        // Determine chain from specificChain since balance doesn't have a chain property
        const chain = balance.specificChain === "svm" ? "svm" : "evm";
        return {
          ...balance,
          chain,
          specificChain: balance.specificChain,
          symbol: balance.symbol,
        };
      });

      return enhancedBalances;
    } catch (error) {
      this.logger.error(
        { error },
        `[AgentManager] Error getting enhanced balances for agent ${agentId}`,
      );
      throw new ApiError(
        500,
        `Failed to get enhanced balances: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
