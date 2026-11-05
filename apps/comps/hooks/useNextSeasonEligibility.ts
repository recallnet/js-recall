import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAccount } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { formatAmount } from "@/utils/format";

/**
 * Response type from the getNextAirdropEligibility RPC
 */
type NextAirdropEligibilityResponse =
  RouterOutputs["airdrop"]["getNextAirdropEligibility"];

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
 * Format bigint value to display format
 */
function formatBigintValue(value: bigint, compact: boolean = true): string {
  const numberValue = attoValueToNumberValue(value);
  if (!numberValue || numberValue === 0) {
    return "0";
  }
  return formatAmount(numberValue, 0, compact);
}

/**
 * Hook for fetching and formatting next season eligibility data
 */
export function useNextSeasonEligibility() {
  const { address } = useAccount();

  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useQuery<NextAirdropEligibilityResponse, Error>(
    tanstackClient.airdrop.getNextAirdropEligibility.queryOptions({
      input: { address: address ?? "" },
      enabled: Boolean(address),
    }),
  );

  const formattedData = useMemo(() => {
    if (!rawData) return null;

    const { activeStake, potentialReward, poolStats, eligibilityReasons } =
      rawData;
    const { totalActiveStakes, availableRewardsPool, totalForfeited } =
      poolStats;
    const { totalUniqueCompetitions } = eligibilityReasons;
    const { minCompetitionsRequired } = rawData;

    const hasStaked = activeStake > 0n;
    const hasBoostedOrCompeted =
      eligibilityReasons.hasBoostedAgents ||
      eligibilityReasons.hasCompetedInCompetitions;

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
      activitySeasonNumber: rawData.activitySeason.number,
      activitySeasonName: rawData.activitySeason.name,
      activitySeasonStartDate: rawData.activitySeason.startDate,
      activitySeasonEndDate: rawData.activitySeason.endDate,
      activeStake,
      activeStakeFormatted: formatBigintValue(activeStake),
      potentialReward,
      potentialRewardFormatted: formatBigintValue(potentialReward),
      hasStaked,
      hasBoostedOrCompeted,
      hasBoostedAgents: eligibilityReasons.hasBoostedAgents,
      hasCompetedInCompetitions: eligibilityReasons.hasCompetedInCompetitions,
      boostedCompetitionIds: eligibilityReasons.boostedCompetitionIds,
      competedCompetitionIds: eligibilityReasons.competedCompetitionIds,
      totalUniqueCompetitions,
      minCompetitionsRequired,
      competitionsRemaining,
      totalActiveStakes,
      totalActiveStakesFormatted: formatBigintValue(totalActiveStakes),
      availableRewardsPool,
      availableRewardsPoolFormatted: formatBigintValue(availableRewardsPool),
      totalForfeited,
      totalForfeitedFormatted: formatBigintValue(totalForfeited),
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
