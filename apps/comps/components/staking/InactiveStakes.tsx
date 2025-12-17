"use client";

import React, { useEffect, useMemo } from "react";
import { useBlock } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { toast } from "@recallnet/ui2/components/toast";

import { useWithdraw } from "@/hooks/staking";
import { useUserStakes } from "@/hooks/useStakingContract";
import type { StakeInfoWithId } from "@/types/staking";
import { formatAmount } from "@/utils/format";

import { Heading } from "./Heading";
import type { StakeEntryAction } from "./StakeEntryBase";
import { StakeEntryBase } from "./StakeEntryBase";
import { calculateTimeProgress } from "./stakeTime";

interface InactiveStakeEntryProps {
  tokenId: bigint;
  amount: bigint;
  lockupEndTime: bigint;
  withdrawAllowedTime: bigint;
  blockTimestamp?: bigint;
}

const InactiveStakeEntry: React.FunctionComponent<InactiveStakeEntryProps> = ({
  tokenId,
  amount,
  lockupEndTime,
  withdrawAllowedTime,
  blockTimestamp,
}) => {
  // Use block timestamp if available, otherwise fall back to Date.now()
  const now = blockTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  const isWithdrawable = now >= withdrawAllowedTime;

  // Per-row hook for independent loading state
  const {
    execute: withdraw,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isConfirmed: isWithdrawConfirmed,
    error: withdrawError,
  } = useWithdraw();

  const isWithdrawing = isWithdrawPending || isWithdrawConfirming;

  useEffect(() => {
    if (isWithdrawConfirmed) {
      toast.success("Successfully withdrawn!");
    }
  }, [isWithdrawConfirmed]);

  useEffect(() => {
    if (withdrawError) {
      toast.error("Failed to withdraw");
      console.error("Withdraw error:", withdrawError);
    }
  }, [withdrawError]);

  const handleWithdraw = async () => {
    try {
      await withdraw(tokenId);
    } catch (error) {
      console.error("Failed to withdraw:", error);
    }
  };

  const formattedAmount = useMemo(() => {
    const value = attoValueToNumberValue(amount);
    return value ? formatAmount(value, 0, true) : "0";
  }, [amount]);

  const boostAmount = "0";

  const timeProgress = useMemo(() => {
    return calculateTimeProgress(
      lockupEndTime,
      withdrawAllowedTime,
      now,
      "Withdrawable",
    );
  }, [lockupEndTime, withdrawAllowedTime, now]);

  const actions: StakeEntryAction[] = [
    {
      label: "WITHDRAW",
      onClick: handleWithdraw,
      disabled: !isWithdrawable || isWithdrawing,
      isLoading: isWithdrawing,
      loadingLabel: "Withdrawing...",
      variant: "secondary",
    },
  ];

  return (
    <StakeEntryBase
      status={isWithdrawable ? "unstaked" : "cooldown"}
      formattedAmount={formattedAmount}
      boostAmount={boostAmount}
      actions={actions}
      progress={
        isWithdrawable
          ? undefined
          : {
              leftLabel: `Unstaked ${timeProgress.startDateFormatted}`,
              leftLabelTooltip: timeProgress.startDateISO,
              rightLabel: `Withdrawable ${timeProgress.endDateFormatted}`,
              rightLabelTooltip: timeProgress.endDateISO,
              progressPercent: timeProgress.progress,
              progressText: timeProgress.progressText,
            }
      }
    />
  );
};

export const InactiveStakes: React.FunctionComponent = () => {
  const { data: allStakes, isLoading, error } = useUserStakes();

  // Filter to show only inactive stakes (withdrawAllowedTime !== 0n)
  const stakes = useMemo(() => {
    const stakesList = allStakes as StakeInfoWithId[] | undefined;
    return (stakesList ?? []).filter(
      (stake) => stake.withdrawAllowedTime !== 0n,
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
        <Heading text1="Inactive" text2="Stakes" className="mb-2" />
        <p className="mb-4 text-sm text-gray-400">Loading your stakes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <Heading text1="Inactive" text2="Stakes" className="mb-2" />
        <p className="mb-4 text-sm text-red-400">
          Error loading stakes: {error.message}
        </p>
      </div>
    );
  }

  if (!stakes || stakes.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 flex flex-col gap-4">
      <Heading text1="Inactive" text2="Stakes" />
      <div className="flex flex-col gap-8">
        {stakes.map((stake: StakeInfoWithId) => (
          <InactiveStakeEntry
            key={stake.tokenId.toString()}
            tokenId={stake.tokenId}
            amount={stake.amount}
            lockupEndTime={stake.lockupEndTime}
            withdrawAllowedTime={stake.withdrawAllowedTime}
            blockTimestamp={blockTimestamp}
          />
        ))}
      </div>
    </div>
  );
};
