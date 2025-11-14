import { Logger } from "pino";

import { ArenaRepository } from "@recallnet/db/repositories/arena";
import type { ClassificationFilters } from "@recallnet/db/repositories/arena";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { InsertArena, SelectArena } from "@recallnet/db/schema/core/types";

import { isCompatibleType } from "./lib/arena-validation.js";
import { buildPaginationResponse } from "./lib/pagination-utils.js";
import { ApiError, PagingParams } from "./types/index.js";

/**
 * Parameters for creating a new arena
 */
export interface CreateArenaParams {
  id: string;
  name: string;
  createdBy: string;
  category: string;
  skill: string;
  venues?: string[];
  chains?: string[];
}

/**
 * Parameters for updating an arena
 */
export interface UpdateArenaParams {
  name?: string;
  category?: string;
  skill?: string;
  venues?: string[];
  chains?: string[];
}

/**
 * Arena Service
 * Manages arena CRUD operations and classification-based discovery
 */
export class ArenaService {
  private arenaRepo: ArenaRepository;
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  constructor(
    arenaRepo: ArenaRepository,
    competitionRepo: CompetitionRepository,
    logger: Logger,
  ) {
    this.arenaRepo = arenaRepo;
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }

  /**
   * Create a new arena
   * @param arenaData Arena data to create
   * @returns Created arena
   */
  async createArena(arenaData: CreateArenaParams): Promise<SelectArena> {
    try {
      // Validate arena ID format (lowercase kebab-case)
      const idRegex = /^[a-z0-9-]+$/;
      if (!idRegex.test(arenaData.id)) {
        throw new ApiError(
          400,
          "Arena ID must be lowercase kebab-case (e.g., 'aerodrome-base-weekly')",
        );
      }

      // Check if arena with this ID already exists
      const existing = await this.arenaRepo.findById(arenaData.id);
      if (existing) {
        throw new ApiError(409, `Arena with ID ${arenaData.id} already exists`);
      }

      const arena: InsertArena = {
        id: arenaData.id,
        name: arenaData.name,
        createdBy: arenaData.createdBy,
        category: arenaData.category,
        skill: arenaData.skill,
        venues: arenaData.venues ?? null,
        chains: arenaData.chains ?? null,
        kind: "Competition",
      };

      const created = await this.arenaRepo.create(arena);

      this.logger.debug(
        `[ArenaService] Created arena: ${arenaData.id} (${arenaData.name})`,
      );

      return created;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error("[ArenaService] Error creating arena:", error);
      throw new ApiError(
        500,
        `Failed to create arena: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find an arena by ID
   * @param id Arena ID
   * @returns Arena if found, throws 404 if not found
   */
  async findById(id: string): Promise<SelectArena> {
    try {
      const arena = await this.arenaRepo.findById(id);

      if (!arena) {
        throw new ApiError(404, `Arena with ID ${id} not found`);
      }

      return arena;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(`[ArenaService] Error finding arena ${id}:`, error);
      throw new ApiError(
        500,
        `Failed to find arena: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find all arenas with pagination
   * @param params Pagination and sorting parameters
   * @param nameFilter Optional name filter
   * @returns Paginated arenas with metadata
   */
  async findAll(
    params: PagingParams,
    nameFilter?: string,
  ): Promise<{
    arenas: SelectArena[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      const { arenas, total } = await this.arenaRepo.findAll(
        params,
        nameFilter,
      );

      return {
        arenas,
        pagination: buildPaginationResponse(total, params.limit, params.offset),
      };
    } catch (error) {
      this.logger.error("[ArenaService] Error finding arenas:", error);
      throw new ApiError(
        500,
        `Failed to find arenas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Update an arena
   * @param id Arena ID
   * @param updateData Fields to update
   * @returns Updated arena
   */
  async update(
    id: string,
    updateData: UpdateArenaParams,
  ): Promise<SelectArena> {
    try {
      // If skill is being changed, validate all existing competitions are compatible
      if (updateData.skill) {
        const existingArena = await this.arenaRepo.findById(id);
        if (!existingArena) {
          throw new ApiError(404, `Arena with ID ${id} not found`);
        }

        // Only validate if skill is actually changing
        if (updateData.skill !== existingArena.skill) {
          // Get all competitions in this arena
          const competitions = await this.competitionRepo.findByArenaId(id, {
            limit: 1000,
            offset: 0,
            sort: "",
          });

          // Check if any competition would become incompatible with new skill
          const incompatibleCompetitions = competitions.competitions.filter(
            (comp) => !isCompatibleType(updateData.skill!, comp.type),
          );

          if (incompatibleCompetitions.length > 0) {
            const competitionNames = incompatibleCompetitions
              .map((c) => c.name)
              .join(", ");
            throw new ApiError(
              400,
              `Cannot change arena skill to "${updateData.skill}": ${incompatibleCompetitions.length} existing competition(s) would become incompatible (${competitionNames})`,
            );
          }
        }
      }

      const updated = await this.arenaRepo.update(id, updateData);

      this.logger.debug(`[ArenaService] Updated arena: ${id}`);

      return updated;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(`[ArenaService] Error updating arena ${id}:`, error);
      throw new ApiError(
        500,
        `Failed to update arena: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete an arena
   * Fails if arena has associated competitions
   * @param id Arena ID
   * @returns True if deleted successfully
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Check if arena can be safely deleted
      const canDelete = await this.arenaRepo.canDelete(id);
      if (!canDelete) {
        throw new ApiError(
          409,
          `Cannot delete arena ${id}: arena has associated competitions`,
        );
      }

      const deleted = await this.arenaRepo.delete(id);

      if (!deleted) {
        throw new ApiError(404, `Arena with ID ${id} not found`);
      }

      this.logger.debug(`[ArenaService] Deleted arena: ${id}`);

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(`[ArenaService] Error deleting arena ${id}:`, error);
      throw new ApiError(
        500,
        `Failed to delete arena: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search arenas by classification filters
   * @param filters Classification filter parameters
   * @returns Array of matching arenas
   */
  async searchByClassification(
    filters: ClassificationFilters,
  ): Promise<SelectArena[]> {
    try {
      return await this.arenaRepo.searchByClassification(filters);
    } catch (error) {
      this.logger.error(
        "[ArenaService] Error searching arenas by classification:",
        error,
      );
      throw new ApiError(
        500,
        `Failed to search arenas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all arenas with competition counts
   * Useful for admin dashboards showing arena activity
   * @param params Pagination parameters
   * @returns Arenas with competition counts and pagination metadata
   */
  async findAllWithCompetitionCounts(params: PagingParams): Promise<{
    arenas: Array<SelectArena & { competitionCount: number }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      const { arenas, total } =
        await this.arenaRepo.findAllWithCompetitionCounts(params);

      return {
        arenas,
        pagination: buildPaginationResponse(total, params.limit, params.offset),
      };
    } catch (error) {
      this.logger.error(
        "[ArenaService] Error finding arenas with counts:",
        error,
      );
      throw new ApiError(
        500,
        `Failed to find arenas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find arenas by category
   * @param category Category value
   * @returns Array of matching arenas
   */
  async findByCategory(category: string): Promise<SelectArena[]> {
    try {
      return await this.arenaRepo.findByCategory(category);
    } catch (error) {
      this.logger.error(
        `[ArenaService] Error finding arenas by category ${category}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to find arenas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find arenas by skill
   * @param skill Skill value
   * @returns Array of matching arenas
   */
  async findBySkill(skill: string): Promise<SelectArena[]> {
    try {
      return await this.arenaRepo.findBySkill(skill);
    } catch (error) {
      this.logger.error(
        `[ArenaService] Error finding arenas by skill ${skill}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to find arenas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get competition count for an arena
   * @param arenaId Arena ID
   * @returns Number of competitions in the arena
   */
  async getCompetitionCount(arenaId: string): Promise<number> {
    try {
      return await this.arenaRepo.getCompetitionCount(arenaId);
    } catch (error) {
      this.logger.error(
        `[ArenaService] Error getting competition count for arena ${arenaId}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to get competition count: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
