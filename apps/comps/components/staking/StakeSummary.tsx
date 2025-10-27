import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { BoostIcon } from "@/components/BoostIcon";
import { Claim } from "@/components/Claim";
import { Recall } from "@/components/Recall";
import { useUserStakes } from "@/hooks/staking";
import { useClaim } from "@/hooks/useClaim";
import { useRecall } from "@/hooks/useRecall";
import type { StakeInfoWithId } from "@/types/staking";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

interface StakeSummaryProps {
  onStakeClick: () => void;
}

export const StakeSummary: React.FunctionComponent<StakeSummaryProps> = ({
  onStakeClick,
}) => {
  const recall = useRecall();
  const { totalClaimable } = useClaim();
  const { data: stakes } = useUserStakes();

  const decimals =
    recall.isLoading || recall.decimals === undefined ? 18 : recall.decimals;

  const availableRaw =
    recall.isLoading || recall.value === undefined ? 0n : recall.value;

  const lockedRaw =
    stakes?.reduce((acc: bigint, s: StakeInfoWithId) => acc + s.amount, 0n) ??
    0n;

  const totalRaw = availableRaw + lockedRaw;

  const total = formatBigintAmount(
    totalRaw,
    decimals,
    shouldShowCompact(totalRaw),
  );
  const locked = formatBigintAmount(
    lockedRaw,
    decimals,
    shouldShowCompact(lockedRaw),
  );
  const available = formatBigintAmount(
    availableRaw,
    decimals,
    shouldShowCompact(availableRaw),
  );

  return (
    <div className="mb-20 rounded-lg border border-[#212C3A] bg-gray-900">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_1fr] sm:gap-6">
        {/* Total */}
        <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
          <div className="mb-2 text-sm font-bold uppercase text-gray-400">
            Total
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Recall size="md" />
              <span className="text-2xl font-bold text-white">{total}</span>
            </div>
            {totalClaimable > 0n && <Claim className="sm:hidden" />}
          </div>
        </div>

        {/* Locked */}
        <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
          <div className="mb-2 text-sm font-bold uppercase text-gray-400">
            Locked
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Recall size="md" />
              <span className="text-2xl font-bold text-white">{locked}</span>
            </div>

            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-yellow-400">+{locked}</span>
              <span className="font-bold">Boost</span>
              <BoostIcon className="size-4" />
              <span>per competition</span>
            </div>
          </div>
        </div>

        {/* Available */}
        <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
          <div className="mb-2 text-sm font-bold uppercase text-gray-400">
            Available
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Recall size="md" />
              <span className="text-2xl font-bold text-white">{available}</span>
            </div>
            <Button
              className="px-6"
              onClick={onStakeClick}
              disabled={availableRaw === 0n}
            >
              STAKE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
