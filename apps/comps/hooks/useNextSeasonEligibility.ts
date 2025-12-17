import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAccount } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { formatAmount } from "@/utils/format";

/**
 * Response type from the getNextSeasonEligibility RPC
 */
export interface NextSeasonEligibilityResponse {
  isEligible: boolean;
  season: number;
  seasonName: string;
  activitySeason: {
    number: number;
    name: string;
    startDate: string;
    endDate: string;
  };
  activeStake: string;
  potentialReward: string;
  eligibilityReasons: {
    hasBoostedAgents: boolean;
    hasCompetedInCompetitions: boolean;
    boostedCompetitionIds: string[];
    competedCompetitionIds: string[];
    totalUniqueCompetitions: number;
  };
  poolStats: {
    totalActiveStakes: string;
    availableRewardsPool: string;
    totalForfeited: string;
    totalAlreadyClaimed: string;
  };
  minCompetitionsRequired: number;
}

/**
 * Formatted eligibility data for UI display
 */
export interface FormattedEligibilityData {
  isEligible: boolean;
  isAlmostEligible: boolean;
  season: number;
  seasonName: string;
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
 * Format bigint value from string to display format
 */
function formatBigintString(value: string, compact: boolean = true): string {
  const bigintValue = BigInt(value);
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
  } = useQuery<NextSeasonEligibilityResponse, Error>(
    tanstackClient.airdrop.getNextSeasonEligibility.queryOptions({
      input: { address: address ?? "" },
      enabled: Boolean(address),
    }),
  );

  const formattedData = useMemo<FormattedEligibilityData | null>(() => {
    if (!rawData) return null;

    const activitySeasonStartDate = new Date(rawData.activitySeason.startDate);
    const activitySeasonEndDate = new Date(rawData.activitySeason.endDate);

    const activeStake = BigInt(rawData.activeStake);
    const potentialReward = BigInt(rawData.potentialReward);
    const totalActiveStakes = BigInt(rawData.poolStats.totalActiveStakes);
    const availableRewardsPool = BigInt(rawData.poolStats.availableRewardsPool);
    const totalForfeited = BigInt(rawData.poolStats.totalForfeited);

    const hasStaked = activeStake > 0n;
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
      season: rawData.season,
      seasonName: rawData.seasonName,
      activitySeasonNumber: rawData.activitySeason.number,
      activitySeasonName: rawData.activitySeason.name,
      activitySeasonStartDate,
      activitySeasonEndDate,
      activeStake,
      activeStakeFormatted: formatBigintString(rawData.activeStake),
      potentialReward,
      potentialRewardFormatted: formatBigintString(rawData.potentialReward),
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
      totalActiveStakes,
      totalActiveStakesFormatted: formatBigintString(
        rawData.poolStats.totalActiveStakes,
      ),
      availableRewardsPool,
      availableRewardsPoolFormatted: formatBigintString(
        rawData.poolStats.availableRewardsPool,
      ),
      totalForfeited,
      totalForfeitedFormatted: formatBigintString(
        rawData.poolStats.totalForfeited,
      ),
      daysRemainingInActivitySeason: getDaysRemaining(activitySeasonEndDate),
    };
  }, [rawData]);

  return {
    data: formattedData,
    isLoading,
    error: error ?? null,
    refetch,
  };
}
