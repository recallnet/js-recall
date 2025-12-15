"use client";

import { Gift } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";

import { useUserBonusBoosts } from "@/hooks/useUserBonusBoosts";
import {
  aggregateBonusBoostsByExpiration,
  formatTimeRemaining,
  getExpirationWarningClass,
  sumBonusBoosts,
} from "@/lib/bonus-boost-utils";
import { formatBigintAmount } from "@/utils/format";

/**
 * Displays bonus boosts in the navbar with a popover showing details
 * @returns Gift icon with total bonus boost amount, or null if no boosts
 */
export const BonusBoosts = () => {
  const { data: bonusBoosts, isLoading } = useUserBonusBoosts();

  if (!bonusBoosts?.length || isLoading) {
    return null;
  }

  const total = sumBonusBoosts(bonusBoosts);
  const aggregatedBoosts = aggregateBonusBoostsByExpiration(bonusBoosts);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="radial-hover hover:hand flex h-full cursor-pointer items-center gap-2 p-2 outline-none"
          aria-label="View bonus boosts"
        >
          <Gift className="radial-hover-text h-5 w-5 text-yellow-400" />
          <span className="radial-hover-text text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-gray-100">
            +{formatBigintAmount(total, 18)}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <div className="space-y-3 p-3">
          <p className="text-base font-semibold">Bonus Boosts</p>
          <div className="space-y-2">
            {aggregatedBoosts.map((boost) => (
              <div
                key={boost.expiresAt}
                className={getExpirationWarningClass(boost.expiresAt)}
              >
                <p className="font-mono text-sm font-semibold">
                  +{formatBigintAmount(BigInt(boost.amount), 18)}
                </p>
                <p className="text-xs">
                  ({formatTimeRemaining(boost.expiresAt)} left)
                </p>
              </div>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
