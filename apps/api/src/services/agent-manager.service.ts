import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { config } from "@/config/index.js";
import {
  count,
  create,
  deactivateAgent,
  deleteAgent,
  findAll,
  findById,
  findByOwnerId,
  findInactiveAgents,
  reactivateAgent,
  searchAgents,
  update,
} from "@/database/repositories/agent-repository.js";
import { InsertAgent } from "@/database/schema/core/types.js";
import { AgentMetadata, AgentSearchParams, ApiAuth } from "@/types/index.js";

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
   * @param walletAddress Optional Ethereum wallet address
   * @returns The created agent with API credentials
   */
  async createAgent(
    ownerId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    metadata?: AgentMetadata,
    walletAddress?: string,
  ) {
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
        metadata, // Add the optional metadata
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
  async getAgentsByOwner(ownerId: string) {
    try {
      return await findByOwnerId(ownerId);
    } catch (error) {
      console.error(
        `[AgentManager] Error retrieving agents for owner ${ownerId}:`,
        error,
      );
      return [];
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
}
