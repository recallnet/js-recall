"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useBlock } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { toast } from "@recallnet/ui2/components/toast";

import { useUnstake } from "@/hooks/staking";
import { useUserStakes } from "@/hooks/useStakingContract";
import type { StakeInfoWithId } from "@/types/staking";
import { formatAmount } from "@/utils/format";

import { RelockRecallModal } from "../modals/relock-recall";
import { Heading } from "./Heading";
import type { StakeEntryAction } from "./StakeEntryBase";
import { StakeEntryBase } from "./StakeEntryBase";
import { calculateTimeProgress } from "./stakeTime";

interface ActiveStakeEntryProps {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  lockupEndTime: bigint;
  blockTimestamp?: bigint;
}

const ActiveStakeEntry: React.FunctionComponent<ActiveStakeEntryProps> = ({
  tokenId,
  amount,
  startTime,
  lockupEndTime,
  blockTimestamp,
}) => {
  // Use block timestamp if available, otherwise fall back to Date.now()
  const now = blockTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  const isLocked = now < lockupEndTime;

  // State for relock modal
  const [isRelockModalOpen, setIsRelockModalOpen] = useState(false);

  // Per-row hooks for independent loading states
  const {
    execute: unstake,
    isPending: isUnstakePending,
    isConfirming: isUnstakeConfirming,
    isConfirmed: isUnstakeConfirmed,
    error: unstakeError,
  } = useUnstake();

  const isUnstakeProcessing = isUnstakePending || isUnstakeConfirming;

  useEffect(() => {
    if (isUnstakeConfirmed) {
      toast.success("Successfully unstaked!");
    }
  }, [isUnstakeConfirmed]);

  useEffect(() => {
    if (unstakeError) {
      toast.error("Failed to unstake");
      console.error("Unstake error:", unstakeError);
    }
  }, [unstakeError]);

  const handleUnstake = async () => {
    try {
      await unstake(tokenId);
    } catch (error) {
      console.error("Failed to unstake:", error);
    }
  };

  const handleOpenRelockModal = () => {
    setIsRelockModalOpen(true);
  };

  const formattedAmount = useMemo(() => {
    const value = attoValueToNumberValue(amount);
    return value ? formatAmount(value, 0, true) : "0";
  }, [amount]);

  const boostAmount = useMemo(() => {
    const value = attoValueToNumberValue(amount);
    return value ? formatAmount(value, 0, true) : "0";
  }, [amount]);

  const timeProgress = useMemo(() => {
    return calculateTimeProgress(startTime, lockupEndTime, now, "Unlocked");
  }, [startTime, lockupEndTime, now]);

  const status = isLocked ? "locked" : "staked";

  const actions: StakeEntryAction[] = [
    {
      label: "UNSTAKE",
      onClick: handleUnstake,
      disabled: isLocked || isUnstakeProcessing,
      isLoading: isUnstakeProcessing,
      loadingLabel: "Unstaking...",
      variant: "secondary",
    },
    {
      label: "RE-STAKE",
      onClick: handleOpenRelockModal,
      disabled: isLocked,
      isLoading: false,
      loadingLabel: "Re-Staking...",
      variant: "primary",
    },
  ];

  return (
    <>
      <StakeEntryBase
        status={status}
        formattedAmount={formattedAmount}
        boostAmount={boostAmount}
        actions={actions}
        progress={
          isLocked
            ? {
                leftLabel: `Staked ${timeProgress.startDateFormatted}`,
                leftLabelTooltip: timeProgress.startDateISO,
                rightLabel: `Unlocks ${timeProgress.endDateFormatted}`,
                rightLabelTooltip: timeProgress.endDateISO,
                progressPercent: timeProgress.progress,
                progressText: timeProgress.progressText,
              }
            : undefined
        }
      />
      <RelockRecallModal
        isOpen={isRelockModalOpen}
        onClose={setIsRelockModalOpen}
        tokenId={tokenId}
        currentAmount={amount}
      />
    </>
  );
};

export const ActiveStakes: React.FunctionComponent = () => {
  const { data: allStakes, isLoading, error } = useUserStakes();

  // Filter to show only active stakes (withdrawAllowedTime === 0n)
  const stakes = useMemo(() => {
    const stakesList = allStakes as StakeInfoWithId[] | undefined;
    return (stakesList ?? []).filter(
      (stake) => stake.withdrawAllowedTime === 0n,
    );
  }, [allStakes]);

  const { data: block } = useBlock({
    query: {
      refetchInterval: 10000,
    },
  });

  const blockTimestamp = block?.timestamp ? BigInt(block.timestamp) : undefined;

  if (isLoading) {
    return (
      <div className="mb-8">
        <Heading text1="Active" text2="Stakes" className="mb-2" />
        <p className="mb-4 text-sm text-gray-400">Loading your stakes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <Heading text1="Active" text2="Stakes" className="mb-2" />
        <p className="mb-4 text-sm text-red-400">
          Error loading stakes: {error.message}
        </p>
      </div>
    );
  }

  if (!stakes || stakes.length === 0) {
    return (
      <div className="mb-8">
        <Heading text1="Active" text2="Stakes" className="mb-2" />
        <div className="border-gray-4 bg-gray-2 px-auto flex flex-col gap-2 rounded-2xl border px-6 py-8">
          <p className="text-sm text-gray-400">
            No active stakes yet. Stake to earn Boost.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4">
      <Heading text1="Active" text2="Stakes" />
      <div className="flex flex-col gap-8">
        {stakes.map((stake: StakeInfoWithId) => (
          <ActiveStakeEntry
            key={stake.tokenId.toString()}
            tokenId={stake.tokenId}
            amount={stake.amount}
            startTime={stake.startTime}
            lockupEndTime={stake.lockupEndTime}
            blockTimestamp={blockTimestamp}
          />
        ))}
      </div>
    </div>
  );
};
