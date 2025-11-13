import { Logger } from "pino";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";

export interface ClaimData {
  season: number;
  seasonName: string;
  allocation: {
    amount: bigint;
    proof: string[];
    ineligibleReason?: string;
  };
  claim: {
    status: "available" | "claimed" | "expired";
    claimedAmount?: bigint;
    stakeDuration?: number;
    unlocksAt?: Date;
  };
}

export class AirdropService {
  private readonly airdropRepository: AirdropRepository;
  private readonly convictionClaimsRepository?: ConvictionClaimsRepository;
  private readonly logger: Logger;

  constructor(
    airdropRepository: AirdropRepository,
    logger: Logger,
    convictionClaimsRepository?: ConvictionClaimsRepository,
  ) {
    this.airdropRepository = airdropRepository;
    this.convictionClaimsRepository = convictionClaimsRepository;
    this.logger = logger;
  }

  /**
   * Get season name based on season number
   */
  private getSeasonName(season: number): string {
    const seasonNames: Record<number, string> = {
      0: "Genesis",
      1: "Season 1",
      2: "Season 2",
      3: "Season 3",
    };
    return seasonNames[season] || `Season ${season}`;
  }

  /**
   * Determine if a claim is eligible based on sybil classification
   */
  private getIneligibilityReason(
    sybilClassification: string,
    flaggingReason?: string | null,
  ): string | undefined {
    if (sybilClassification === "sybil") {
      return flaggingReason || "Account flagged as sybil";
    }
    if (sybilClassification === "maybe-sybil") {
      return "Account under review for potential sybil activity";
    }
    return undefined;
  }

  /**
   * Calculate unlock date for staked tokens
   */
  private calculateUnlockDate(
    claimTimestamp: Date,
    durationInSeconds: bigint,
  ): Date {
    const unlockTime = new Date(claimTimestamp);
    unlockTime.setSeconds(unlockTime.getSeconds() + Number(durationInSeconds));
    return unlockTime;
  }

  /**
   * Determine claim status based on various factors
   */
  private determineClaimStatus(
    claimed: boolean,
    ineligible: boolean,
    expiryDate?: Date,
  ): "available" | "claimed" | "expired" {
    if (claimed) {
      return "claimed";
    }
    if (ineligible) {
      return "expired"; // Ineligible claims are treated as expired
    }
    if (expiryDate && new Date() > expiryDate) {
      return "expired";
    }
    return "available";
  }

  /**
   * Get all airdrop claims data for an account across all seasons
   */
  async getAccountClaimsData(address: string): Promise<ClaimData[]> {
    try {
      this.logger.info(`Fetching claims data for address: ${address}`);

      // Get all airdrop allocations and claim status for the address
      const allocations =
        await this.airdropRepository.getAllAllocationsForAddress(address);

      // Get conviction claims data if repository is available
      let convictionClaims: Array<{
        id: string;
        account: string;
        eligibleAmount: bigint;
        claimedAmount: bigint;
        season: number;
        duration: bigint;
        blockNumber: bigint;
        blockTimestamp: Date;
        transactionHash: Buffer | Uint8Array;
      }> = [];
      if (this.convictionClaimsRepository) {
        convictionClaims =
          await this.convictionClaimsRepository.getClaimsByAccount(address);
      }

      // Build claims data for each allocation
      const claimsData: ClaimData[] = allocations.map((allocation) => {
        // Find corresponding conviction claim for this season
        const convictionClaim = convictionClaims.find(
          (cc) => cc.season === allocation.season,
        );

        // Determine eligibility
        const ineligibleReason = this.getIneligibilityReason(
          allocation.sybilClassification,
          allocation.flaggingReason,
        );

        // Determine claim status
        const isClaimed = convictionClaim !== undefined;
        const isIneligible = ineligibleReason !== undefined;
        // TODO: Add actual expiry date logic based on business rules
        const expiryDate = undefined; // Placeholder for expiry logic

        const status = this.determineClaimStatus(
          isClaimed,
          isIneligible,
          expiryDate,
        );

        // Calculate unlock date if claimed with staking
        let unlocksAt: Date | undefined;
        if (convictionClaim && convictionClaim.duration > 0n) {
          unlocksAt = this.calculateUnlockDate(
            convictionClaim.blockTimestamp,
            convictionClaim.duration,
          );
        }

        // Convert stake duration from seconds to days
        const stakeDurationInDays = convictionClaim
          ? Number(convictionClaim.duration) / 86400
          : undefined;

        return {
          season: allocation.season,
          seasonName: this.getSeasonName(allocation.season),
          allocation: {
            amount: allocation.amount,
            proof: allocation.proof,
            ineligibleReason,
          },
          claim: {
            status,
            claimedAmount: convictionClaim?.claimedAmount,
            stakeDuration: stakeDurationInDays,
            unlocksAt,
          },
        };
      });

      // Sort by season (most recent first)
      claimsData.sort((a, b) => b.season - a.season);

      this.logger.info(
        `Successfully fetched ${claimsData.length} claims for address ${address}`,
      );

      return claimsData;
    } catch (error) {
      this.logger.error(
        `Error fetching claims data for address ${address}:`,
        error,
      );
      throw error;
    }
  }

  // Keep the existing checkEligibility method for backward compatibility
  async checkEligibility(address: string, season: number) {
    // TODO: Whatever checks we want to do.
    // No idea if/how season fits in here.
    console.log(`season is ${season}, address is ${address}`); // log to fix lint
    const res = await this.airdropRepository.getAllocationByAddress(address);
    return res;
  }
}
