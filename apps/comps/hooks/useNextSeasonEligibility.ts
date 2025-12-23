import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAccount } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { formatAmount } from "@/utils/format";

/**
 * Formatted eligibility data for UI display
 */
export interface FormattedEligibilityData {
  isEligible: boolean;
  isAlmostEligible: boolean;
  airdrop: number;
  airdropName: string;
  activitySeasonNumber: number;
  activitySeasonName: string;
  activitySeasonStartDate: Date;
  activitySeasonEndDate: Date;
  daysRemainingInActivitySeason: number;
  activeStake: bigint;
  activeStakeFormatted: string;
  potentialReward: bigint;
  potentialRewardFormatted: string;
  hasStaked: boolean;
  hasBoostedOrCompeted: boolean;
  hasBoostedAgents: boolean;
  hasCompetedInCompetitions: boolean;
  /** Competition IDs where the user boosted agents */
  boostedCompetitionIds: string[];
  /** Competition IDs where the user's agents competed */
  competedCompetitionIds: string[];
  /** Total count of unique competitions (boosted + competed combined) */
  totalUniqueCompetitions: number;
  /** Minimum number of competitions required for eligibility */
  minCompetitionsRequired: number;
  /** How many more competitions are needed to become eligible */
  competitionsRemaining: number;
  totalActiveStakes: bigint;
  totalActiveStakesFormatted: string;
  availableRewardsPool: bigint;
  availableRewardsPoolFormatted: string;
  totalForfeited: bigint;
  totalForfeitedFormatted: string;
}

/**
 * Calculate whole days remaining until a target date.
 *
 * @param endDate - Target date
 * @param now - Reference time (defaults to current time)
 * @returns Non-negative number of whole days remaining, rounded up
 */
function getDaysRemaining(endDate: Date, now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / msPerDay);
}

/**
 * Hook result type
 */
export interface UseNextSeasonEligibilityResult {
  data: FormattedEligibilityData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Format bigint value to display format
 */
function formatBigint(bigintValue: bigint, compact: boolean = true): string {
  const numberValue = attoValueToNumberValue(bigintValue);
  if (!numberValue || numberValue === 0) {
    return "0";
  }
  return formatAmount(numberValue, 0, compact);
}

/**
 * Hook for fetching and formatting next season eligibility data
 */
export function useNextSeasonEligibility(): UseNextSeasonEligibilityResult {
  const { address } = useAccount();

  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    tanstackClient.airdrop.getNextAirdropEligibility.queryOptions({
      input: { address: address ?? "" },
      enabled: Boolean(address),
    }),
  );

  const formattedData = useMemo<FormattedEligibilityData | null>(() => {
    if (!rawData) return null;

    const hasStaked = rawData.activeStake > 0n;
    const hasBoostedOrCompeted =
      rawData.eligibilityReasons.hasBoostedAgents ||
      rawData.eligibilityReasons.hasCompetedInCompetitions;

    const { totalUniqueCompetitions } = rawData.eligibilityReasons;
    const { minCompetitionsRequired } = rawData;
    const competitionsRemaining = Math.max(
      0,
      minCompetitionsRequired - totalUniqueCompetitions,
    );

    // User is "almost eligible" if they have staked but haven't met the competition requirement
    // or if they have met the competition requirement but haven't staked
    const hasMetCompetitionRequirement =
      totalUniqueCompetitions >= minCompetitionsRequired;
    const isAlmostEligible =
      (hasStaked && !hasMetCompetitionRequirement) ||
      (!hasStaked && hasMetCompetitionRequirement);

    return {
      isEligible: rawData.isEligible,
      isAlmostEligible,
      airdrop: rawData.airdrop,
      airdropName: rawData.airdropName,
      activitySeasonNumber: rawData.activitySeason.number,
      activitySeasonName: rawData.activitySeason.name,
      activitySeasonStartDate: rawData.activitySeason.startDate,
      activitySeasonEndDate: rawData.activitySeason.endDate,
      activeStake: rawData.activeStake,
      activeStakeFormatted: formatBigint(rawData.activeStake),
      potentialReward: rawData.potentialReward,
      potentialRewardFormatted: formatBigint(rawData.potentialReward),
      hasStaked,
      hasBoostedOrCompeted,
      hasBoostedAgents: rawData.eligibilityReasons.hasBoostedAgents,
      hasCompetedInCompetitions:
        rawData.eligibilityReasons.hasCompetedInCompetitions,
      boostedCompetitionIds: rawData.eligibilityReasons.boostedCompetitionIds,
      competedCompetitionIds: rawData.eligibilityReasons.competedCompetitionIds,
      totalUniqueCompetitions,
      minCompetitionsRequired,
      competitionsRemaining,
      totalActiveStakes: rawData.poolStats.totalActiveStakes,
      totalActiveStakesFormatted: formatBigint(
        rawData.poolStats.totalActiveStakes,
      ),
      availableRewardsPool: rawData.poolStats.availableRewardsPool,
      availableRewardsPoolFormatted: formatBigint(
        rawData.poolStats.availableRewardsPool,
      ),
      totalForfeited: rawData.poolStats.totalForfeited,
      totalForfeitedFormatted: formatBigint(rawData.poolStats.totalForfeited),
      daysRemainingInActivitySeason: getDaysRemaining(
        rawData.activitySeason.endDate,
      ),
    };
  }, [rawData]);

  return {
    data: formattedData,
    isLoading,
    error: error ?? null,
    refetch,
  };
}
