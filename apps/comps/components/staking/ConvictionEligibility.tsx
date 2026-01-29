"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useMemo } from "react";
import { useAccount } from "wagmi";

import { Recall } from "@/components/Recall";
import { useNextSeasonEligibility } from "@/hooks/useNextSeasonEligibility";
import { useConviction } from "@/providers/conviction-provider";

import { Button } from "./Button";
import { Heading } from "./Heading";

interface StatusBadgeProps {
  isEligible: boolean;
  isAlmostEligible: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  isEligible,
  isAlmostEligible,
}) => {
  if (isEligible) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#A8E6CF] px-3 py-1 text-xs font-medium text-black">
        Eligible
      </span>
    );
  }

  if (isAlmostEligible) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#FCD569] px-3 py-1 text-xs font-medium text-black">
        Almost eligible
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-500 px-3 py-1 text-xs font-medium text-white">
      Not eligible
    </span>
  );
};

interface RequirementItemProps {
  isCompleted: boolean;
  text: string;
}

const RequirementItem: React.FC<RequirementItemProps> = ({
  isCompleted,
  text,
}) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${
          isCompleted ? "bg-white" : "border border-gray-500 bg-transparent"
        }`}
      />
      <span className={isCompleted ? "text-gray-200" : "text-gray-500"}>
        {text}
      </span>
    </div>
  );
};

export const ConvictionEligibility: React.FunctionComponent = () => {
  const { address } = useAccount();
  const { isConvictionEligible } = useConviction();
  const { data: eligibility, isLoading, error } = useNextSeasonEligibility();

  const airdropDisplayName = useMemo(() => {
    if (!eligibility) return "UPCOMING AIRDROP";
    return `Airdrop ${eligibility.airdrop}`;
  }, [eligibility]);

  // Determine the action button state
  const actionState = useMemo(() => {
    if (!eligibility) return { type: "none" as const };

    if (eligibility.isEligible) {
      return {
        type: "eligible" as const,
        days: eligibility.daysRemainingInActivitySeason,
      };
    }

    if (!eligibility.hasStaked) {
      return {
        type: "stake" as const,
        days: eligibility.daysRemainingInActivitySeason,
      };
    }

    // Check if user needs more competitions (not meeting the minimum)
    if (eligibility.competitionsRemaining > 0) {
      return {
        type: "boost" as const,
        days: eligibility.daysRemainingInActivitySeason,
        competitionsRemaining: eligibility.competitionsRemaining,
      };
    }

    return { type: "none" as const };
  }, [eligibility]);

  // Don't render if user doesn't have conviction eligibility (no airdrop claims)
  if (!isConvictionEligible) {
    return null;
  }

  if (!address) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-8">
        <Heading text1="Conviction" text2="Staking" className="mb-4" />
        <div className="bg-gray-2 border-gray-4 flex h-48 animate-pulse items-center justify-center rounded-lg border">
          <p className="text-gray-5 text-sm">Loading eligibility...</p>
        </div>
      </div>
    );
  }

  if (error || !eligibility) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Heading text1="Conviction" text2="Staking" />

      <div className="border-gray-4 group relative overflow-hidden rounded-2xl border bg-black">
        {/* Background images - static JPG by default, animated GIF on hover */}
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-0 h-full w-1/2 overflow-hidden md:w-2/5">
          {/* Static background (visible by default, hidden on hover) */}
          <Image
            src="/conviction-claim.jpg"
            alt=""
            fill
            className="object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-0"
            priority={false}
          />
          {/* Animated GIF (hidden by default, visible on hover) */}
          <Image
            src="/conviction-claim.gif"
            alt=""
            fill
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            priority={false}
            unoptimized
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-2 p-4">
          {/* Two sections container */}
          <div className="flex flex-col gap-2 md:flex-row">
            {/* Section 1 - Season info and requirements */}
            <div className="bg-gray-3 border-gray-4 flex w-auto flex-col gap-3 rounded-xl border p-4">
              {/* Season header with badge */}
              <div className="flex items-center gap-3">
                <span className="text-gray-5 text-sm font-bold uppercase">
                  {airdropDisplayName}
                </span>
                <StatusBadge
                  isEligible={eligibility.isEligible}
                  isAlmostEligible={eligibility.isAlmostEligible}
                />
              </div>

              {/* Requirements list */}
              <div className="flex flex-col gap-2">
                <RequirementItem
                  isCompleted={eligibility.hasStaked}
                  text="Stake your Airdrop Rewards."
                />
                <RequirementItem
                  isCompleted={eligibility.competitionsRemaining === 0}
                  text={`Participate in ${eligibility.minCompetitionsRequired}+ competitions (${eligibility.totalUniqueCompetitions}/${eligibility.minCompetitionsRequired}).`}
                />
              </div>
            </div>

            {/* Section 2 - Pool stats (side by side) */}
            <div className="bg-gray-3 border-gray-4 flex w-auto flex-row items-center gap-6 rounded-xl border p-4">
              {/* Reward Pool */}
              <div className="flex flex-col gap-1">
                <span className="text-gray-5 mb-2 text-sm font-bold uppercase">
                  REWARD POOL
                </span>
                <div className="flex items-center gap-2">
                  <Recall size="sm" />
                  <span className="text-gray-6 text-xl font-bold">
                    {eligibility.availableRewardsPoolFormatted}
                  </span>
                  <span className="text-gray-5 text-sm">
                    /{eligibility.totalForfeitedFormatted}
                  </span>
                </div>
              </div>

              {/* Estimated Share */}
              <div className="flex flex-col gap-1">
                <span className="text-gray-5 mb-2 text-sm font-bold uppercase">
                  EST. SHARE
                </span>
                <div className="flex items-center gap-2">
                  <Recall size="sm" />
                  <span className="text-gray-6 text-xl font-bold">
                    {eligibility.potentialRewardFormatted}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions section - below both sections */}
          <div className="flex items-center gap-3 pt-2">
            {actionState.type === "stake" && (
              <>
                <Button asChild className="px-6">
                  <Link href="/stake">STAKE</Link>
                </Button>
                <span className="text-sm text-[#FCD569]">
                  {actionState.days} days to Claim & Stake
                </span>
              </>
            )}

            {actionState.type === "boost" && (
              <>
                <Button asChild className="px-6">
                  <Link href="/competitions">BOOST</Link>
                </Button>
                <span className="text-sm text-[#FCD569]">
                  {actionState.competitionsRemaining} more competition
                  {actionState.competitionsRemaining === 1 ? "" : "s"} needed •{" "}
                  {actionState.days} days left
                </span>
              </>
            )}

            {actionState.type === "eligible" && (
              <div className="bg-gray-4 rounded-lg px-4 py-2">
                <span className="text-gray-6 font-mono text-sm font-semibold tracking-wider">
                  REWARDS SNAPSHOT IN {actionState.days} DAYS
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
