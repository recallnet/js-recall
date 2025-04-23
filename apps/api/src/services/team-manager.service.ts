import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Team, ApiAuth, AgentMetadata } from '../types';
import { config } from '../config';
import { repositories } from '../database';

/**
 * Team Manager Service
 * Manages team registration and API key authentication
 */
export class TeamManager {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, ApiAuth>;
  // Cache for inactive teams to avoid repeated database lookups
  private inactiveTeamsCache: Map<string, { reason: string; date: Date }>;

  constructor() {
    this.apiKeyCache = new Map();
    this.inactiveTeamsCache = new Map();
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
   * Register a new team
   * @param name Team name
   * @param email Contact email
   * @param contactPerson Contact person name
   * @param walletAddress Ethereum wallet address (must start with 0x)
   * @param metadata Optional agent metadata
   * @returns The created team with API credentials
   */
  async registerTeam(
    name: string,
    email: string,
    contactPerson: string,
    walletAddress: string,
    metadata?: AgentMetadata,
  ): Promise<Team> {
    try {
      // Validate wallet address
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      if (!this.isValidEthereumAddress(walletAddress)) {
        throw new Error(
          'Invalid Ethereum address format. Must be 0x followed by 40 hex characters.',
        );
      }

      // Generate team ID
      const id = uuidv4();

      // Generate API key (longer, more secure format)
      const apiKey = this.generateApiKey();

      // Encrypt API key for storage
      const encryptedApiKey = this.encryptApiKey(apiKey);

      // Create team record
      const team: Team = {
        id,
        name,
        email,
        contactPerson,
        apiKey: encryptedApiKey, // Store encrypted key in database
        walletAddress,
        metadata, // Add the optional metadata
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const savedTeam = await repositories.teamRepository.create(team);

      // Update cache with plaintext key
      this.apiKeyCache.set(apiKey, {
        teamId: id,
        key: apiKey,
      });

      console.log(`[TeamManager] Registered team: ${name} (${id})`);

      // Return team with unencrypted apiKey for display to admin
      return {
        ...savedTeam,
        apiKey, // Return unencrypted key
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('[TeamManager] Error registering team:', error);
        throw error;
      }

      console.error('[TeamManager] Unknown error registering team:', error);
      throw new Error(`Failed to register team: ${error}`);
    }
  }

  /**
   * Get a team by ID
   * @param teamId The team ID
   * @returns The team or null if not found
   */
  async getTeam(teamId: string): Promise<Team | null> {
    try {
      return await repositories.teamRepository.findById(teamId);
    } catch (error) {
      console.error(`[TeamManager] Error retrieving team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Get all teams
   * @param includeAdmins Whether to include admin accounts in the results (default: true)
   * @returns Array of teams, filtered by the includeAdmins parameter
   */
  async getAllTeams(includeAdmins: boolean = true): Promise<Team[]> {
    try {
      const teams = await repositories.teamRepository.findAll();

      // Filter out admin teams if needed
      const filteredTeams = includeAdmins ? teams : teams.filter((team) => !team.isAdmin);

      return filteredTeams.map((team) => ({
        ...team,
      }));
    } catch (error) {
      console.error('[TeamManager] Error retrieving all teams:', error);
      return [];
    }
  }

  /**
   * Validate an API key and check if the team is allowed to access
   * @param apiKey The API key to validate
   * @returns The team ID if valid and not inactive, null otherwise
   * @throws Error if the team is inactive
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    try {
      // First check cache
      const cachedAuth = this.apiKeyCache.get(apiKey);
      if (cachedAuth) {
        // Check if the team is inactive
        if (this.inactiveTeamsCache.has(cachedAuth.teamId)) {
          const deactivationInfo = this.inactiveTeamsCache.get(cachedAuth.teamId);
          throw new Error(
            `Your team has been deactivated from the competition: ${deactivationInfo?.reason}`,
          );
        }
        return cachedAuth.teamId;
      }

      // If not in cache, search all teams and check if any decrypted key matches
      const teams = await repositories.teamRepository.findAll();

      for (const team of teams) {
        try {
          const decryptedKey = this.decryptApiKey(team.apiKey);

          if (decryptedKey === apiKey) {
            // Found matching team, check if inactive
            if (team.active === false && !team.isAdmin) {
              // Cache the deactivation info
              this.inactiveTeamsCache.set(team.id, {
                reason: team.deactivationReason || 'No reason provided',
                date: team.deactivationDate || new Date(),
              });
              throw new Error(
                `Your team has been deactivated from the competition: ${team.deactivationReason}`,
              );
            }

            // Add to cache
            this.apiKeyCache.set(apiKey, {
              teamId: team.id,
              key: apiKey,
            });

            return team.id;
          }
        } catch (decryptError) {
          // Log but continue checking other teams
          console.error(`[TeamManager] Error decrypting key for team ${team.id}:`, decryptError);
        }
      }

      // No matching team found
      return null;
    } catch (error) {
      console.error('[TeamManager] Error validating API key:', error);
      throw error; // Re-throw to allow middleware to handle it
    }
  }

  /**
   * Generate a new API key
   * @returns A unique API key
   */
  public generateApiKey(): string {
    // Generate just 2 segments for a shorter key
    const segment1 = crypto.randomBytes(8).toString('hex'); // 16 chars
    const segment2 = crypto.randomBytes(8).toString('hex'); // 16 chars

    // Combine with a prefix and separator underscore for readability
    const key = `${segment1}_${segment2}`;
    console.log(`[TeamManager] Generated API key with length: ${key.length}`);
    return key;
  }

  /**
   * Encrypt an API key for database storage
   * @param key The API key to encrypt
   * @returns The encrypted key
   */
  public encryptApiKey(key: string): string {
    try {
      console.log(`[TeamManager] Encrypting API key with length: ${key.length}`);
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash('sha256')
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const cipher = crypto.createCipheriv(algorithm, cryptoKey, iv);
      let encrypted = cipher.update(key, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return the IV and encrypted data together, clearly separated
      const result = `${iv.toString('hex')}:${encrypted}`;
      console.log(`[TeamManager] Encrypted key length: ${result.length}`);
      return result;
    } catch (error) {
      console.error('[TeamManager] Error encrypting API key:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypt an encrypted API key
   * @param encryptedKey The encrypted API key
   * @returns The original API key
   */
  private decryptApiKey(encryptedKey: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedKey.split(':');

      if (parts.length !== 2) {
        throw new Error('Invalid encrypted key format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash('sha256')
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[TeamManager] Error decrypting API key:', error);
      throw error;
    }
  }

  /**
   * Get a decrypted API key for a specific team
   * This is intended only for admin access to help teams that have lost their API keys
   * @param teamId ID of the team whose API key should be retrieved
   * @returns Object with success status, the decrypted API key if successful, team details, and error information if not
   */
  public async getDecryptedApiKeyById(teamId: string): Promise<{
    success: boolean;
    apiKey?: string;
    team?: {
      id: string;
      name: string;
    };
    errorCode?: number;
    errorMessage?: string;
  }> {
    try {
      // Get the team
      const team = await repositories.teamRepository.findById(teamId);

      if (!team) {
        return {
          success: false,
          errorCode: 404,
          errorMessage: 'Team not found',
        };
      }

      // Check if this is an admin account
      if (team.isAdmin) {
        return {
          success: false,
          errorCode: 403,
          errorMessage: 'Cannot retrieve API key for admin accounts',
        };
      }

      try {
        // Use the private method to decrypt the key
        const apiKey = this.decryptApiKey(team.apiKey);
        return {
          success: true,
          apiKey,
          team: {
            id: team.id,
            name: team.name,
          },
        };
      } catch (decryptError) {
        console.error(`[TeamManager] Error decrypting API key for team ${teamId}:`, decryptError);
        return {
          success: false,
          errorCode: 500,
          errorMessage: 'Failed to decrypt API key',
        };
      }
    } catch (error) {
      console.error(`[TeamManager] Error retrieving decrypted API key for team ${teamId}:`, error);
      return {
        success: false,
        errorCode: 500,
        errorMessage: 'Server error retrieving API key',
      };
    }
  }

  /**
   * Check if the system is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const count = await repositories.teamRepository.count();
      return count >= 0;
    } catch (error) {
      console.error('[TeamManager] Health check failed:', error);
      return false;
    }
  }

  /**
   * Delete a team by ID
   * @param teamId The team ID to delete
   * @returns true if team was deleted, false otherwise
   */
  async deleteTeam(teamId: string): Promise<boolean> {
    try {
      // Get the team to find its API key
      const team = await repositories.teamRepository.findById(teamId);

      if (!team) {
        console.log(`[TeamManager] Team not found for deletion: ${teamId}`);
        return false;
      }

      // Remove from cache if present
      if (team.apiKey) {
        this.apiKeyCache.delete(team.apiKey);
      }

      // Delete the team from the database
      const deleted = await repositories.teamRepository.delete(teamId);

      if (deleted) {
        console.log(`[TeamManager] Successfully deleted team: ${team.name} (${teamId})`);
      } else {
        console.log(`[TeamManager] Failed to delete team: ${team.name} (${teamId})`);
      }

      return deleted;
    } catch (error) {
      console.error(`[TeamManager] Error deleting team ${teamId}:`, error);
      throw new Error(`Failed to delete team: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Deactivate a team
   * @param teamId Team ID to deactivate
   * @param reason Reason for deactivation
   * @returns The deactivated team or null if team not found
   */
  async deactivateTeam(teamId: string, reason: string): Promise<Team | null> {
    try {
      console.log(`[TeamManager] Deactivating team: ${teamId}, Reason: ${reason}`);

      // Call repository to deactivate the team
      const deactivatedTeam = await repositories.teamRepository.deactivateTeam(teamId, reason);

      if (!deactivatedTeam) {
        console.log(`[TeamManager] Team not found for deactivation: ${teamId}`);
        return null;
      }

      // Update deactivation cache
      this.inactiveTeamsCache.set(teamId, {
        reason: reason,
        date: deactivatedTeam.deactivationDate || new Date(),
      });

      console.log(
        `[TeamManager] Successfully deactivated team: ${deactivatedTeam.name} (${teamId})`,
      );

      return deactivatedTeam;
    } catch (error) {
      console.error(`[TeamManager] Error deactivating team ${teamId}:`, error);
      throw new Error(
        `Failed to deactivate team: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Reactivate a team
   * @param teamId Team ID to reactivate
   * @returns The reactivated team or null if team not found
   */
  async reactivateTeam(teamId: string): Promise<Team | null> {
    try {
      console.log(`[TeamManager] Reactivating team: ${teamId}`);

      // Call repository to reactivate the team
      const reactivatedTeam = await repositories.teamRepository.reactivateTeam(teamId);

      if (!reactivatedTeam) {
        console.log(`[TeamManager] Team not found for reactivation: ${teamId}`);
        return null;
      }

      // Remove from inactive cache
      this.inactiveTeamsCache.delete(teamId);

      console.log(
        `[TeamManager] Successfully reactivated team: ${reactivatedTeam.name} (${teamId})`,
      );

      return reactivatedTeam;
    } catch (error) {
      console.error(`[TeamManager] Error reactivating team ${teamId}:`, error);
      throw new Error(
        `Failed to reactivate team: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Update a team's information
   * @param team The team object with updated fields
   * @returns The updated team or null if team not found
   */
  async updateTeam(team: Team): Promise<Team | null> {
    try {
      console.log(`[TeamManager] Updating team: ${team.id} (${team.name})`);

      // Check if team exists
      const existingTeam = await repositories.teamRepository.findById(team.id);
      if (!existingTeam) {
        console.log(`[TeamManager] Team not found for update: ${team.id}`);
        return null;
      }

      // Always set updated timestamp
      team.updatedAt = new Date();

      // Save to database
      const updatedTeam = await repositories.teamRepository.update(team);
      if (!updatedTeam) {
        console.log(`[TeamManager] Failed to update team: ${team.id}`);
        return null;
      }

      console.log(`[TeamManager] Successfully updated team: ${updatedTeam.name} (${team.id})`);
      return updatedTeam;
    } catch (error) {
      console.error(`[TeamManager] Error updating team ${team.id}:`, error);
      throw new Error(`Failed to update team: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get all inactive teams
   * @returns Array of inactive teams
   */
  async getInactiveTeams(): Promise<Team[]> {
    try {
      return await repositories.teamRepository.findInactiveTeams();
    } catch (error) {
      console.error('[TeamManager] Error retrieving inactive teams:', error);
      return [];
    }
  }

  /**
   * Check if a team is inactive
   * @param teamId Team ID to check
   * @returns Object with inactive status and reason if applicable
   */
  async isTeamInactive(
    teamId: string,
  ): Promise<{ isInactive: boolean; reason?: string; date?: Date }> {
    try {
      // Check cache first
      if (this.inactiveTeamsCache.has(teamId)) {
        const info = this.inactiveTeamsCache.get(teamId);
        return {
          isInactive: true,
          reason: info?.reason,
          date: info?.date,
        };
      }

      // If not in cache, check database
      const team = await repositories.teamRepository.findById(teamId);

      if (!team) {
        return { isInactive: false };
      }

      if (team.active === false) {
        // Update cache
        this.inactiveTeamsCache.set(teamId, {
          reason: team.deactivationReason || 'No reason provided',
          date: team.deactivationDate || new Date(),
        });

        return {
          isInactive: true,
          reason: team.deactivationReason,
          date: team.deactivationDate,
        };
      }

      return { isInactive: false };
    } catch (error) {
      console.error(`[TeamManager] Error checking inactive status for team ${teamId}:`, error);
      return { isInactive: false };
    }
  }
}
