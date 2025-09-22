import {
  type BoostAgentResult,
  BoostRepository,
} from "@recallnet/db/repositories/boost";

import { serviceLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type { CompetitionService } from "@/services/competition.service.js";
import type { UserService } from "@/services/user.service.js";

/**
 * Parameters for boosting an agent
 */
export interface BoostAgentParams {
  userId: string;
  competitionId: string;
  agentId: string;
  amount: bigint;
  idemKey: Buffer;
}

/**
 * Boost Service
 * Manages boost operations including validation and business logic
 */
export class BoostService {
  private boostRepository: BoostRepository;
  private competitionService: CompetitionService;
  private userService: UserService;

  constructor(
    boostRepository: BoostRepository,
    competitionService: CompetitionService,
    userService: UserService,
  ) {
    this.boostRepository = boostRepository;
    this.competitionService = competitionService;
    this.userService = userService;
  }

  /**
   * Get user boost balance for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns The user's boost balance
   */
  async getUserBoostBalance(
    userId: string,
    competitionId: string,
  ): Promise<bigint> {
    try {
      // Get the user to validate they exist
      const user = await this.userService.getUser(userId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      return await this.boostRepository.userBoostBalance({
        userId: user.id,
        competitionId,
      });
    } catch (error) {
      serviceLogger.error(
        `[BoostService] Error getting user boost balance:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get agent boost totals for a competition
   * @param competitionId The competition ID
   * @returns Map of agent IDs to their boost totals
   */
  async getAgentBoostTotals(
    competitionId: string,
  ): Promise<Record<string, bigint>> {
    try {
      return await this.boostRepository.agentBoostTotals({
        competitionId,
      });
    } catch (error) {
      serviceLogger.error(
        `[BoostService] Error getting agent boost totals:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user boosts for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns Map of agent IDs to boost amounts
   */
  async getUserBoosts(
    userId: string,
    competitionId: string,
  ): Promise<Record<string, bigint>> {
    try {
      return await this.boostRepository.userBoosts({
        userId,
        competitionId,
      });
    } catch (error) {
      serviceLogger.error(`[BoostService] Error getting user boosts:`, error);
      throw error;
    }
  }

  /**
   * Boost an agent in a competition
   * @param params The boost parameters
   * @returns The result of the boost operation
   */
  async boostAgent(params: BoostAgentParams): Promise<BoostAgentResult> {
    try {
      const { userId, competitionId, agentId, amount, idemKey } = params;

      // Get the user to validate they exist and get wallet address
      const user = await this.userService.getUser(userId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Get and validate the competition
      const competition =
        await this.competitionService.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "No competition found.");
      }

      // Validate voting dates are set
      if (
        competition.votingStartDate == null ||
        competition.votingEndDate == null
      ) {
        throw new ApiError(
          500,
          "Can't boost in a competition with no defined boost start date or end date.",
        );
      }

      // Validate we're within the voting time window
      const now = new Date();
      if (
        !(competition.votingStartDate < now && now < competition.votingEndDate)
      ) {
        throw new ApiError(
          400,
          "Can't boost in a competition outside of the boost time window.",
        );
      }

      // Execute the boost
      const result = await this.boostRepository.boostAgent({
        userId,
        wallet: user.walletAddress,
        agentId,
        competitionId,
        amount,
        idemKey,
      });

      return result;
    } catch (error) {
      serviceLogger.error(`[BoostService] Error boosting agent:`, error);
      throw error;
    }
  }
}
