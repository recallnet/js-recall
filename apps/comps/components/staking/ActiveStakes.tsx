"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import React, { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Button } from "@recallnet/ui2/components/button";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { Recall } from "@/components/Recall";
import { useRelock, useUnstake } from "@/hooks/staking";
import { useUserStakes } from "@/hooks/useStakingContract";
import type { StakeInfoWithId } from "@/types/staking";
import { formatAmount, formatDate } from "@/utils/format";

import { BoostIcon } from "../BoostIcon";
import { StatusPill } from "./StatusPill";

interface ActiveStakeEntryProps {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  lockupEndTime: bigint;
  onUnstake: (tokenId: bigint) => void;
  onRelock: (tokenId: bigint) => void;
}

const ActiveStakeEntry: React.FunctionComponent<ActiveStakeEntryProps> = ({
  tokenId,
  amount,
  startTime,
  lockupEndTime,
  onUnstake,
  onRelock,
}) => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isLocked = now < lockupEndTime;

  const formattedAmount = useMemo(() => {
    const value = attoValueToNumberValue(amount);
    return value ? formatAmount(value, 0, true) : "0";
  }, [amount]);

  const boostAmount = useMemo(() => {
    const value = attoValueToNumberValue(amount);
    return value ? formatAmount(value, 0, true) : "0";
  }, [amount]);

  const stakedDate = useMemo(() => {
    return formatDate(new Date(Number(startTime) * 1000));
  }, [startTime]);

  const unlockDate = useMemo(() => {
    return formatDate(new Date(Number(lockupEndTime) * 1000));
  }, [lockupEndTime]);

  const stakedDateISO = useMemo(() => {
    return new Date(Number(startTime) * 1000).toISOString();
  }, [startTime]);

  const unlockDateISO = useMemo(() => {
    return new Date(Number(lockupEndTime) * 1000).toISOString();
  }, [lockupEndTime]);

  const progress = useMemo(() => {
    if (!isLocked) return 100;
    const totalDuration = Number(lockupEndTime - startTime);
    const elapsed = Number(now - startTime);
    return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
  }, [isLocked, startTime, lockupEndTime, now]);

  const progressText = useMemo(() => {
    if (!isLocked) return "Unlocked";
    const totalDays = Math.ceil(
      Number(lockupEndTime - startTime) / (24 * 60 * 60),
    );
    const elapsedDays = Math.floor(Number(now - startTime) / (24 * 60 * 60));
    return `${elapsedDays}/${totalDays} days (${Math.round(progress)}%)`;
  }, [isLocked, startTime, lockupEndTime, now, progress]);

  const status = isLocked ? "locked" : "staked";
  return (
    <div className="xs:p-4 rounded-lg border border-[#212C3A] bg-gray-900 p-3 transition-colors hover:bg-gray-800">
      <div className="flex flex-col items-stretch justify-between">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <StatusPill status={status} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-4">
                <Recall size="md" />
                <span className="text-lg font-semibold text-white">
                  {formattedAmount}
                </span>
              </div>
              <div className="hidden text-gray-400 sm:block">
                <ArrowRightIcon />
              </div>
              <div className="flex items-center gap-1 text-yellow-400">
                <BoostIcon fill />
                <span className="font-bold">{boostAmount}</span>
                <span className="text-gray-400">per competition.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={isLocked}
              onClick={() => onUnstake(tokenId)}
            >
              UNSTAKE
            </Button>
            <Button
              variant="default"
              disabled={isLocked}
              onClick={() => onRelock(tokenId)}
            >
              LOCK
            </Button>
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="mt-4 flex items-center justify-between gap-8 text-sm text-gray-400">
          <Tooltip content={stakedDateISO}>
            <span className="cursor-help">Staked {stakedDate}</span>
          </Tooltip>
          <div className="xs:flex hidden max-w-md flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full bg-[#6D85A4] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-primary-foreground">{progressText}</span>
          </div>
          <Tooltip content={unlockDateISO} className="text-right">
            <span className="cursor-help">Unlocks {unlockDate}</span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export const ActiveStakes: React.FunctionComponent = () => {
  const { data: stakes, isLoading, error } = useUserStakes();
  const { execute: unstake } = useUnstake();
  const { execute: relock } = useRelock();

  const handleUnstake = async (tokenId: bigint) => {
    try {
      await unstake(tokenId);
    } catch (error) {
      console.error("Failed to unstake:", error);
    }
  };

  const handleRelock = async (tokenId: bigint) => {
    try {
      // For now, relock with the same amount and a default duration
      const defaultDuration = BigInt(7 * 24 * 60 * 60); // 7 days in seconds
      await relock(tokenId, defaultDuration);
    } catch (error) {
      console.error("Failed to relock:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-white">Active Stakes</h2>
        <p className="mb-4 text-sm text-gray-400">Loading your stakes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-white">Active Stakes</h2>
        <p className="mb-4 text-sm text-red-400">
          Error loading stakes: {error.message}
        </p>
      </div>
    );
  }

  if (!stakes || stakes.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-white">Active Stakes</h2>
        <p className="mb-4 text-sm text-gray-400">
          No active stakes yet. Stake to earn Boost.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-white">Active Stakes</h2>
      <div className="flex flex-col gap-8">
        {stakes.map((stake: StakeInfoWithId) => (
          <ActiveStakeEntry
            key={stake.tokenId.toString()}
            tokenId={stake.tokenId}
            amount={stake.amount}
            startTime={stake.startTime}
            lockupEndTime={stake.lockupEndTime}
            onUnstake={handleUnstake}
            onRelock={handleRelock}
          />
        ))}
      </div>
    </div>
  );
};
