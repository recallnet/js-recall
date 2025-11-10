import { Logger } from "pino";

import { PartnerRepository } from "@recallnet/db/repositories/partner";
import {
  InsertPartner,
  SelectCompetitionPartner,
  SelectPartner,
} from "@recallnet/db/schema/core/types";

import { buildPaginationResponse } from "./lib/pagination-utils.js";
import { ApiError, PagingParams } from "./types/index.js";

/**
 * Parameters for creating a new partner
 */
export interface CreatePartnerParams {
  name: string;
  url?: string;
  logoUrl?: string;
  details?: string;
}

/**
 * Parameters for updating a partner
 */
export interface UpdatePartnerParams {
  name?: string;
  url?: string;
  logoUrl?: string;
  details?: string;
}

/**
 * Parameters for adding a partner to a competition
 */
export interface AddPartnerToCompetitionParams {
  competitionId: string;
  partnerId: string;
  position: number;
}

/**
 * Partner Service
 * Manages partner CRUD operations and competition associations
 */
export class PartnerService {
  private partnerRepo: PartnerRepository;
  private logger: Logger;

  constructor(partnerRepo: PartnerRepository, logger: Logger) {
    this.partnerRepo = partnerRepo;
    this.logger = logger;
  }

  /**
   * Create a new partner
   * @param partnerData Partner data to create
   * @returns Created partner
   */
  async createPartner(
    partnerData: CreatePartnerParams,
  ): Promise<SelectPartner> {
    try {
      // Check if partner with this name already exists
      const existing = await this.partnerRepo.findByName(partnerData.name);
      if (existing) {
        throw new ApiError(
          409,
          `Partner with name ${partnerData.name} already exists`,
        );
      }

      const partner: InsertPartner = {
        name: partnerData.name,
        url: partnerData.url ?? null,
        logoUrl: partnerData.logoUrl ?? null,
        details: partnerData.details ?? null,
      };

      const created = await this.partnerRepo.create(partner);

      this.logger.debug(
        `[PartnerService] Created partner: ${partnerData.name} (${created.id})`,
      );

      return created;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error("[PartnerService] Error creating partner:", error);
      throw new ApiError(
        500,
        `Failed to create partner: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find a partner by ID
   * @param id Partner ID
   * @returns Partner if found, throws 404 if not found
   */
  async findById(id: string): Promise<SelectPartner> {
    try {
      const partner = await this.partnerRepo.findById(id);

      if (!partner) {
        throw new ApiError(404, `Partner with ID ${id} not found`);
      }

      return partner;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(`[PartnerService] Error finding partner ${id}:`, error);
      throw new ApiError(
        500,
        `Failed to find partner: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find all partners with pagination
   * @param params Pagination and sorting parameters
   * @param nameFilter Optional name filter
   * @returns Paginated partners with metadata
   */
  async findAll(
    params: PagingParams,
    nameFilter?: string,
  ): Promise<{
    partners: SelectPartner[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      const { partners, total } = await this.partnerRepo.findAll(
        params,
        nameFilter,
      );

      return {
        partners,
        pagination: buildPaginationResponse(total, params.limit, params.offset),
      };
    } catch (error) {
      this.logger.error("[PartnerService] Error finding partners:", error);
      throw new ApiError(
        500,
        `Failed to find partners: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Update a partner
   * @param id Partner ID
   * @param updateData Fields to update
   * @returns Updated partner
   */
  async update(
    id: string,
    updateData: UpdatePartnerParams,
  ): Promise<SelectPartner> {
    try {
      const updated = await this.partnerRepo.update(id, updateData);

      this.logger.debug(`[PartnerService] Updated partner: ${id}`);

      return updated;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error updating partner ${id}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to update partner: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete a partner
   * Note: Will cascade delete all competition associations
   * @param id Partner ID
   * @returns True if deleted successfully
   */
  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await this.partnerRepo.delete(id);

      if (!deleted) {
        throw new ApiError(404, `Partner with ID ${id} not found`);
      }

      this.logger.debug(`[PartnerService] Deleted partner: ${id}`);

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error deleting partner ${id}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to delete partner: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find all partners for a competition (ordered by position)
   * @param competitionId Competition ID
   * @returns Array of partners with their positions
   */
  async findByCompetition(competitionId: string): Promise<
    Array<
      SelectPartner & {
        position: number;
        competitionPartnerId: string;
      }
    >
  > {
    try {
      return await this.partnerRepo.findByCompetition(competitionId);
    } catch (error) {
      this.logger.error(
        `[PartnerService] Error finding partners for competition ${competitionId}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to find partners: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Add a partner to a competition
   * @param params Competition ID, Partner ID, and display position
   * @returns Created competition partner association
   */
  async addToCompetition(
    params: AddPartnerToCompetitionParams,
  ): Promise<SelectCompetitionPartner> {
    try {
      // Verify partner exists
      await this.findById(params.partnerId); // Throws 404 if not found

      const association = await this.partnerRepo.addToCompetition(
        params.competitionId,
        params.partnerId,
        params.position,
      );

      this.logger.debug(
        `[PartnerService] Added partner ${params.partnerId} to competition ${params.competitionId} at position ${params.position}`,
      );

      return association;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error adding partner to competition:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to add partner to competition: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Remove a partner from a competition
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @returns True if removed successfully
   */
  async removeFromCompetition(
    competitionId: string,
    partnerId: string,
  ): Promise<boolean> {
    try {
      const removed = await this.partnerRepo.removeFromCompetition(
        competitionId,
        partnerId,
      );

      if (!removed) {
        throw new ApiError(
          404,
          `Partner association not found (comp: ${competitionId}, partner: ${partnerId})`,
        );
      }

      this.logger.debug(
        `[PartnerService] Removed partner ${partnerId} from competition ${competitionId}`,
      );

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error removing partner from competition:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to remove partner from competition: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Update a partner's position in a competition
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param newPosition New display position
   * @returns Updated competition partner association
   */
  async updatePosition(
    competitionId: string,
    partnerId: string,
    newPosition: number,
  ): Promise<SelectCompetitionPartner> {
    try {
      const updated = await this.partnerRepo.updatePosition(
        competitionId,
        partnerId,
        newPosition,
      );

      this.logger.debug(
        `[PartnerService] Updated partner ${partnerId} position in competition ${competitionId} to ${newPosition}`,
      );

      return updated;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error updating partner position:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to update partner position: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Replace all partners for a competition atomically
   * Useful for bulk updates from admin panel
   * @param competitionId Competition ID
   * @param partnerData Array of partner IDs with positions
   * @returns Array of created competition partner associations
   */
  async replaceCompetitionPartners(
    competitionId: string,
    partnerData: Array<{
      partnerId: string;
      position: number;
    }>,
  ): Promise<
    Array<
      SelectPartner & {
        position: number;
        competitionPartnerId: string;
      }
    >
  > {
    try {
      // Verify all partners exist before making changes
      await Promise.all(partnerData.map((p) => this.findById(p.partnerId)));

      await this.partnerRepo.replaceCompetitionPartners(
        competitionId,
        partnerData,
      );

      this.logger.debug(
        `[PartnerService] Replaced partners for competition ${competitionId} (${partnerData.length} partners)`,
      );

      // Fetch enriched data to return (consistent with GET endpoint)
      return await this.partnerRepo.findByCompetition(competitionId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(
        `[PartnerService] Error replacing competition partners:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to replace competition partners: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find or create a partner by name (idempotent)
   * Useful when processing partner data from submissions
   * @param partnerData Partner data
   * @returns Existing or newly created partner
   */
  async findOrCreate(partnerData: CreatePartnerParams): Promise<SelectPartner> {
    try {
      const partner: Omit<InsertPartner, "id" | "createdAt" | "updatedAt"> = {
        name: partnerData.name,
        url: partnerData.url ?? null,
        logoUrl: partnerData.logoUrl ?? null,
        details: partnerData.details ?? null,
      };

      const result = await this.partnerRepo.findOrCreate(partner);

      this.logger.debug(
        `[PartnerService] Found or created partner: ${partnerData.name} (${result.id})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[PartnerService] Error in findOrCreate for ${partnerData.name}:`,
        error,
      );
      throw new ApiError(
        500,
        `Failed to find or create partner: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
