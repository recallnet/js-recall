"use client";

import { useMemo } from "react";
import { Gift } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";

import { useUserBonusBoosts } from "@/hooks/useUserBonusBoosts";
import {
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

  // Aggregate boosts by expiration time and sum amounts
  const aggregatedByExpiration = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const boost of bonusBoosts) {
      const key = boost.expiresAt; // ISO 8601 string
      const prev = map.get(key) ?? 0n;
      map.set(key, prev + BigInt(boost.amount));
    }
    // Return sorted array by expiration ascending
    return Array.from(map.entries())
      .map(([expiresAt, amount]) => ({ expiresAt, amount }))
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [bonusBoosts]);

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
            {aggregatedByExpiration.map((entry) => (
              <div
                key={entry.expiresAt}
                className={getExpirationWarningClass(entry.expiresAt)}
              >
                <p className="font-mono text-sm font-semibold">
                  +{formatBigintAmount(entry.amount, 18)}
                </p>
                <p className="text-xs">
                  ({formatTimeRemaining(entry.expiresAt)} left)
                </p>
              </div>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
