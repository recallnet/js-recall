import React from "react";

import { BoostIcon } from "@/components/BoostIcon";
import { Claim } from "@/components/Claim";
import { Recall } from "@/components/Recall";
import { Button } from "@/components/staking/Button";
import { useUserStakes } from "@/hooks/staking";
import { useClaim } from "@/hooks/useClaim";
import { useRecall } from "@/hooks/useRecall";
import type { StakeInfoWithId } from "@/types/staking";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

import { Heading } from "./Heading";

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
    <div className="flex flex-col gap-4">
      <Heading text1="Wallet" text2="Balance" />
      <div className="bg-gray-2 border-gray-4 mb-20 rounded-lg border">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_1fr] sm:gap-6">
          {/* Total */}
          <div className="flex flex-col border-r p-4 sm:p-6">
            <div className="text-gray-5 mb-2 text-sm font-bold uppercase">
              Total Active
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Recall size="md" />
                <span className="text-gray-6 text-2xl font-bold">{total}</span>
              </div>
              {totalClaimable > 0n && <Claim className="sm:hidden" />}
            </div>
          </div>

          {/* Staked */}
          <div className="relative flex flex-col p-4 sm:p-6">
            <div className="bg-gray-4 absolute bottom-7 right-0 top-7 hidden w-px sm:block" />
            <div className="flex w-fit flex-col sm:mx-auto">
              <div className="text-gray-5 mb-2 text-sm font-bold uppercase">
                Staked
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                <div className="flex items-center gap-2">
                  <Recall size="md" />
                  <span className="text-gray-6 text-2xl font-bold">
                    {locked}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-sm">
                  <span className="font-bold text-yellow-400">+{locked}</span>
                  <span className="font-bold">Boost</span>
                  <BoostIcon className="size-4" />
                  <span>per competition</span>
                </div>
              </div>
            </div>
          </div>

          {/* Available */}
          <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
            <div className="flex w-fit flex-col sm:ml-auto">
              <div className="text-gray-5 mb-2 text-sm font-bold uppercase">
                Available
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Recall size="md" />
                  <span className="text-gray-6 text-2xl font-bold">
                    {available}
                  </span>
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
      </div>
    </div>
  );
};
