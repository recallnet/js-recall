import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { toOrdinal } from "@/utils/format";

/**
 * Props for the Rewards component.
 */
export interface RewardsProps {
  /**
   * Array of reward objects, each with a rank and reward amount.
   */
  rewards: { rank: number; reward: number }[];
  /**
   * Optional className for the root element.
   */
  className?: string;
  /**
   * If true, only displays the total rewards amount.
   * @default false
   */
  compact?: boolean;
}

/**
 * Displays the total rewards and the 1st, 2nd, and 3rd place rewards in a responsive flex layout.
 *
 * @param rewards - Array of reward objects with rank and reward amount.
 * @param className - Optional className for the root element.
 * @param compact - If true, only displays the total rewards amount.
 *
 * @example
 * <Rewards rewards={[{rank: 1, reward: 2500}, {rank: 2, reward: 1500}, {rank: 3, reward: 1000}]} />
 * <Rewards rewards={[{rank: 1, reward: 2500}, {rank: 2, reward: 1500}, {rank: 3, reward: 1000}]} compact />
 */
export const Rewards: React.FC<RewardsProps> = ({
  rewards,
  className,
  compact = false,
}) => {
  const total = rewards.reduce((sum, r) => sum + r.reward, 0);

  if (compact) {
    return (
      <div className={cn("text-primary-foreground font-bold", className)}>
        $
        {total.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}
      </div>
    );
  }

  const rankMap: Record<number, { label: string; color: string }> = {
    1: { label: "1st", color: "text-[#FBD362]" },
    2: { label: "2nd", color: "text-[#93A5BA]" },
    3: { label: "3rd", color: "text-[#C76E29]" },
  };

  const sorted = [...rewards].sort((a, b) => a.rank - b.rank);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="text-primary-foreground font-bold">
        {total > 0 ? (
          <>
            $
            {total.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}{" "}
            in rewards!
          </>
        ) : (
          "TBA"
        )}
      </div>
      <div className="flex flex-col flex-wrap gap-2 lg:flex-row lg:gap-3">
        {sorted.slice(0, 3).map((r) => (
          <div key={r.rank} className="flex items-center gap-1 text-sm">
            <span className={rankMap[r.rank]?.color || ""}>
              {toOrdinal(r.rank)}
            </span>
            <span className="text-primary-foreground font-bold">
              $
              {r.reward.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rewards;
