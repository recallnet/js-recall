import { Logger } from "pino";
import { recoverMessageAddress } from "viem";

import { EigenaiRepository } from "@recallnet/db/repositories/eigenai";
import type {
  InsertSignatureSubmission,
  SelectSignatureSubmission,
  VerificationStatus,
} from "@recallnet/db/schema/eigenai/types";

import { checkUniqueConstraintViolation } from "./lib/error-utils.js";
import { ApiError } from "./types/index.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Chain ID used for EigenAI message reconstruction.
 * The dTERMinal API uses mainnet chain ID.
 */
const EIGENAI_CHAIN_ID = "1";

/**
 * Expected signer address for EigenAI signatures.
 * This is the dTERMinal API signer for mainnet.
 */
const EIGENAI_EXPECTED_SIGNER = "0x7053bfb0433a16a2405de785d547b1b32cee0cf3";

/**
 * Minimum number of verified signatures in 24h to have an active badge.
 */
const BADGE_ACTIVE_THRESHOLD = 1;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Request to submit a signature for verification
 */
export interface SubmitSignatureRequest {
  agentId: string;
  competitionId: string;
  /** Concatenated content from all request messages */
  requestPrompt: string;
  /** Model ID from EigenAI response (e.g., "gpt-oss-120b-f16") */
  responseModel: string;
  /** Full output content from EigenAI response */
  responseOutput: string;
  /** 65-byte hex signature from EigenAI response */
  signature: string;
}

/**
 * Result of a signature submission
 */
export interface SubmitSignatureResult {
  submission: SelectSignatureSubmission;
  verified: boolean;
  badgeStatus: {
    isBadgeActive: boolean;
    signaturesLast24h: number;
  };
}

/**
 * Result of signature verification
 */
export interface VerificationResult {
  isValid: boolean;
  status: VerificationStatus;
  recoveredAddress: string | null;
  error?: string;
}

/**
 * Agent badge status for API response
 */
export interface AgentBadgeStatusResponse {
  agentId: string;
  competitionId: string;
  isBadgeActive: boolean;
  signaturesLast24h: number;
  lastVerifiedAt: Date | null;
}

/**
 * Competition EigenAI statistics
 */
export interface CompetitionEigenaiStats {
  competitionId: string;
  totalAgentsWithSubmissions: number;
  agentsWithActiveBadge: number;
  totalVerifiedSignatures: number;
}

/**
 * Service configuration
 */
export interface EigenaiServiceConfig {
  eigenai: {
    chainId?: string;
    expectedSigner?: string;
    badgeActiveThreshold?: number;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * EigenAI Service
 *
 * Handles EigenAI verifiable inference badge operations including:
 * - Signature verification using viem
 * - Signature submission storage
 * - Badge status management
 * - Badge refresh for cron jobs
 */
export class EigenaiService {
  private eigenaiRepository: EigenaiRepository;
  private logger: Logger;
  private chainId: string;
  private expectedSigner: string;
  private badgeActiveThreshold: number;

  constructor(
    eigenaiRepository: EigenaiRepository,
    config: EigenaiServiceConfig,
    logger: Logger,
  ) {
    this.eigenaiRepository = eigenaiRepository;
    this.logger = logger;
    this.chainId = config.eigenai.chainId ?? EIGENAI_CHAIN_ID;
    this.expectedSigner =
      config.eigenai.expectedSigner ?? EIGENAI_EXPECTED_SIGNER;
    this.badgeActiveThreshold =
      config.eigenai.badgeActiveThreshold ?? BADGE_ACTIVE_THRESHOLD;
  }

  // ===========================================================================
  // SIGNATURE VERIFICATION
  // ===========================================================================

  /**
   * Verify an EigenAI signature
   *
   * Reconstructs the message from components and verifies the signature
   * matches the expected signer address.
   *
   * @param requestPrompt Concatenated prompt content
   * @param responseModel Model ID from response
   * @param responseOutput Full output content
   * @param signature Hex signature string
   * @returns Verification result with status
   */
  async verifySignature(
    requestPrompt: string,
    responseModel: string,
    responseOutput: string,
    signature: string,
  ): Promise<VerificationResult> {
    try {
      // Reconstruct message: chainId + model + prompt + output (no separators)
      const message = `${this.chainId}${responseModel}${requestPrompt}${responseOutput}`;

      // Ensure signature has 0x prefix
      const sigHex = signature.startsWith("0x")
        ? (signature as `0x${string}`)
        : (`0x${signature}` as `0x${string}`);

      // Recover signer address
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature: sigHex,
      });

      // Check if recovered address matches expected signer
      const isValid =
        recoveredAddress.toLowerCase() === this.expectedSigner.toLowerCase();

      return {
        isValid,
        status: isValid ? "verified" : "invalid",
        recoveredAddress,
      };
    } catch (error) {
      this.logger.error(
        { error },
        "[EigenaiService] Error verifying signature",
      );

      return {
        isValid: false,
        status: "invalid",
        recoveredAddress: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ===========================================================================
  // SIGNATURE SUBMISSION
  // ===========================================================================

  /**
   * Submit and verify a signature from an agent
   *
   * Verifies the signature, stores it, and returns the current badge status.
   *
   * @param request Signature submission request
   * @returns Submission result with verification status and badge info
   */
  async submitSignature(
    request: SubmitSignatureRequest,
  ): Promise<SubmitSignatureResult> {
    const {
      agentId,
      competitionId,
      requestPrompt,
      responseModel,
      responseOutput,
      signature,
    } = request;

    this.logger.debug(
      `[EigenaiService] Submitting signature for agent=${agentId}, competition=${competitionId}`,
    );

    // Verify the signature
    const verification = await this.verifySignature(
      requestPrompt,
      responseModel,
      responseOutput,
      signature,
    );

    // Prepare submission data
    const submissionData: InsertSignatureSubmission = {
      agentId,
      competitionId,
      signature,
      chainId: this.chainId,
      requestPrompt,
      responseModel,
      responseOutput,
      verificationStatus: verification.status,
      submittedAt: new Date(),
    };

    // Store the submission (handles duplicate signature detection)
    let submission: SelectSignatureSubmission;
    try {
      submission =
        await this.eigenaiRepository.createSignatureSubmission(submissionData);
    } catch (error) {
      // Check for unique constraint violation (duplicate signature)
      const constraint = checkUniqueConstraintViolation(error);
      if (constraint?.includes("signature")) {
        throw new ApiError(
          409,
          "This signature has already been submitted for this competition",
        );
      }
      throw error;
    }

    this.logger.debug(
      `[EigenaiService] Stored submission id=${submission.id}, verified=${verification.isValid}`,
    );

    // Get current badge status (may not exist yet)
    let badgeStatus = await this.eigenaiRepository.getBadgeStatus(
      agentId,
      competitionId,
    );

    // If verified, update badge status inline for immediate feedback
    if (verification.isValid) {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count recent verified submissions
      const recentCount =
        await this.eigenaiRepository.countVerifiedSubmissionsSince(
          agentId,
          competitionId,
          twentyFourHoursAgo,
        );

      // Upsert badge status
      badgeStatus = await this.eigenaiRepository.upsertBadgeStatus({
        agentId,
        competitionId,
        isBadgeActive: recentCount >= this.badgeActiveThreshold,
        signaturesLast24h: recentCount,
        lastVerifiedAt: now,
      });
    }

    return {
      submission,
      verified: verification.isValid,
      badgeStatus: {
        isBadgeActive: badgeStatus?.isBadgeActive ?? false,
        signaturesLast24h: badgeStatus?.signaturesLast24h ?? 0,
      },
    };
  }

  // ===========================================================================
  // BADGE STATUS
  // ===========================================================================

  /**
   * Get badge status for an agent in a competition
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Badge status or null if no submissions
   */
  async getAgentBadgeStatus(
    agentId: string,
    competitionId: string,
  ): Promise<AgentBadgeStatusResponse | null> {
    const status = await this.eigenaiRepository.getBadgeStatus(
      agentId,
      competitionId,
    );

    if (!status) {
      return null;
    }

    return {
      agentId: status.agentId,
      competitionId: status.competitionId,
      isBadgeActive: status.isBadgeActive,
      signaturesLast24h: status.signaturesLast24h,
      lastVerifiedAt: status.lastVerifiedAt,
    };
  }

  /**
   * Check if an agent has an active badge in a competition
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns true if badge is active
   */
  async isAgentBadgeActive(
    agentId: string,
    competitionId: string,
  ): Promise<boolean> {
    return this.eigenaiRepository.isAgentBadgeActive(agentId, competitionId);
  }

  /**
   * Get badge statuses for multiple agents in a competition
   *
   * @param agentIds Array of agent IDs
   * @param competitionId Competition ID
   * @returns Map of agent ID to badge active status
   */
  async getBulkAgentBadgeStatuses(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, boolean>> {
    const statusMap = await this.eigenaiRepository.getBulkAgentBadgeStatuses(
      agentIds,
      competitionId,
    );

    // Convert to simple boolean map
    const result = new Map<string, boolean>();
    for (const [agentId, status] of statusMap) {
      result.set(agentId, status.isBadgeActive);
    }

    return result;
  }

  /**
   * Get active badges for a competition (for leaderboard display)
   *
   * @param competitionId Competition ID
   * @param options Pagination options
   * @returns Array of badge statuses with agent info
   */
  async getActiveBadgesForCompetition(
    competitionId: string,
    options?: { limit?: number; offset?: number },
  ) {
    return this.eigenaiRepository.getActiveBadgesForCompetition(
      competitionId,
      options,
    );
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get EigenAI statistics for a competition
   *
   * @param competitionId Competition ID
   * @returns Competition statistics
   */
  async getCompetitionStats(
    competitionId: string,
  ): Promise<CompetitionEigenaiStats> {
    const stats =
      await this.eigenaiRepository.getCompetitionBadgeStats(competitionId);

    return {
      competitionId,
      ...stats,
    };
  }

  // ===========================================================================
  // SUBMISSION HISTORY
  // ===========================================================================

  /**
   * Get signature submissions for an agent in a competition
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param options Pagination and filter options
   * @returns Paginated submissions
   */
  async getAgentSubmissions(
    agentId: string,
    competitionId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: VerificationStatus;
    },
  ) {
    return this.eigenaiRepository.getAgentSubmissions(
      agentId,
      competitionId,
      options,
    );
  }

  // ===========================================================================
  // BADGE REFRESH (FOR CRON JOB)
  // ===========================================================================

  /**
   * Refresh badge statuses for a competition
   *
   * Called by cron job to recalculate badge status for all agents
   * based on their verified signatures in the last 24 hours.
   *
   * For active competitions: uses current time as reference
   * For ended competitions: uses referenceDate (typically competition endDate)
   * to create a frozen snapshot of badge status at that point in time
   *
   * @param competitionId Competition ID
   * @param referenceDate Point in time to calculate from (defaults to now)
   * @returns Number of agents updated
   */
  async refreshBadgeStatuses(
    competitionId: string,
    referenceDate?: Date,
  ): Promise<number> {
    const reference = referenceDate ?? new Date();
    const windowStart = new Date(reference.getTime() - 24 * 60 * 60 * 1000);

    this.logger.debug(
      `[EigenaiService] Refreshing badge statuses for competition=${competitionId}, reference=${reference.toISOString()}`,
    );

    // Get aggregated data for all agents with submissions
    // When referenceDate is provided, bound the window to only count submissions up to that point
    const refreshData = await this.eigenaiRepository.getBadgeRefreshData(
      competitionId,
      windowStart,
      referenceDate, // Pass as upper bound only if explicitly provided
    );

    if (refreshData.length === 0) {
      this.logger.debug(
        `[EigenaiService] No agents with submissions in competition=${competitionId}`,
      );
      return 0;
    }

    // Prepare badge status updates
    const statusUpdates = refreshData.map(
      (data: {
        agentId: string;
        competitionId: string;
        verifiedCount: number;
        lastVerifiedAt: Date | null;
      }) => ({
        agentId: data.agentId,
        competitionId: data.competitionId,
        isBadgeActive: data.verifiedCount >= this.badgeActiveThreshold,
        signaturesLast24h: data.verifiedCount,
        lastVerifiedAt: data.lastVerifiedAt,
      }),
    );

    // Batch upsert all statuses
    const results =
      await this.eigenaiRepository.batchUpsertBadgeStatuses(statusUpdates);

    this.logger.info(
      `[EigenaiService] Refreshed ${results.length} badge statuses for competition=${competitionId}`,
    );

    return results.length;
  }

  /**
   * Get all badge statuses for a competition
   *
   * Returns all badge statuses (active and inactive) for a competition.
   * Used by frontend to determine if any agent has a badge and conditionally
   * show/hide badge columns.
   *
   * @param competitionId Competition ID
   * @returns Array of badge statuses with active flag
   */
  async getAllBadgeStatusesForCompetition(
    competitionId: string,
  ): Promise<AgentBadgeStatusResponse[]> {
    const statuses =
      await this.eigenaiRepository.getAllBadgeStatusesForCompetition(
        competitionId,
      );

    return statuses.map((status) => ({
      agentId: status.agentId,
      competitionId: status.competitionId,
      isBadgeActive: status.isBadgeActive,
      signaturesLast24h: status.signaturesLast24h,
      lastVerifiedAt: status.lastVerifiedAt,
    }));
  }

  /**
   * Get all badge statuses for an agent across all competitions
   *
   * Returns all badge statuses for a single agent across all their competitions.
   * Used by agent profile page to show badges in the competitions table.
   *
   * @param agentId Agent ID
   * @returns Array of badge statuses keyed by competition ID
   */
  async getBadgeStatusesForAgent(
    agentId: string,
  ): Promise<AgentBadgeStatusResponse[]> {
    const statuses =
      await this.eigenaiRepository.getBadgeStatusesForAgent(agentId);

    return statuses.map((status) => ({
      agentId: status.agentId,
      competitionId: status.competitionId,
      isBadgeActive: status.isBadgeActive,
      signaturesLast24h: status.signaturesLast24h,
      lastVerifiedAt: status.lastVerifiedAt,
    }));
  }
}
