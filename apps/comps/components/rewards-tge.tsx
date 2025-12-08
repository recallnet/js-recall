import React, { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { cn } from "@recallnet/ui2/lib/utils";

import { formatAmount } from "@/utils/format";

import { Recall } from "./Recall";

/**
 * Props for the Rewards component.
 */
export interface RewardsTGEProps {
  /**
   * Two prize pool amounts, agentPrizePool and userPrizePool.
   */
  rewards: { agentPrizePool: bigint; userPrizePool: bigint };
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

export interface SingleRewardTGEValueProps {
  values: string[];
  className?: string;
  compact?: boolean;
}

export const SingleRewardTGEValue: React.FC<SingleRewardTGEValueProps> = ({
  values,
  className,
}) => {
  const formattedValue = useMemo(() => {
    const addedValues = values.reduce(
      (acc, value) => acc + BigInt(value),
      BigInt(0),
    );
    const val = attoValueToNumberValue(addedValues);
    return val ? formatAmount(val, 0, true) : "0";
  }, [values]);
  return (
    <span
      className={cn(
        "text-primary-foreground inline-flex items-center gap-1 font-bold",
        className,
      )}
    >
      <Recall size="sm" />
      {formattedValue}
    </span>
  );
};

/**
 * Displays the total rewards and the 1st, 2nd, and 3rd place rewards in a responsive flex layout.
 *
 * @param rewards - Two prize pool amounts, agentPrizePool and userPrizePool.
 * @param className - Optional className for the root element.
 *
 * @example
 * <RewardsTGE rewards={{ agentPrizePool: 2500, userPrizePool: 1500 }} />
 */
export const RewardsTGE: React.FC<RewardsTGEProps> = ({
  rewards,
  className,
  compact = false,
}) => {
  const formattedRewards = useMemo(() => {
    const agentValue = attoValueToNumberValue(rewards.agentPrizePool);
    const userValue = attoValueToNumberValue(rewards.userPrizePool);
    const totalValue = attoValueToNumberValue(
      rewards.agentPrizePool + rewards.userPrizePool,
    );

    return {
      agentPrizePool: agentValue ? formatAmount(agentValue, 0, true) : "0",
      userPrizePool: userValue ? formatAmount(userValue, 0, true) : "0",
      totalValue: totalValue ? formatAmount(totalValue, 0, true) : "0",
    };
  }, [rewards]);

  if (compact) {
    return (
      <div
        className={cn(
          "text-primary-foreground flex items-center gap-1 font-bold",
          className,
        )}
      >
        <Recall size="sm" />
        {formattedRewards.totalValue}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-row gap-6">
      <div className="flex items-center gap-2">
        <span className="text-secondary-foreground text-sm">Agents</span>
        <span className="flex items-center gap-1.5 font-bold text-white">
          <Recall size="sm" />
          {formattedRewards.agentPrizePool.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-secondary-foreground text-sm">Boosters</span>
        <span className="flex items-center gap-1.5 font-bold text-white">
          <Recall size="sm" />
          {formattedRewards.userPrizePool.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default RewardsTGE;
