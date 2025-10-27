import { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { useTotalUserStaked } from "@/hooks/staking";
import { formatAmount, formatCompactNumber } from "@/utils/format";

import { BoostIcon } from "../BoostIcon";

/**
 * Component that displays the user's total staked amount
 * Shows the total RECALL tokens staked by the current user
 */
export const StakeBoost = () => {
  const { data: totalStaked, isLoading, error } = useTotalUserStaked();

  const stakeValue = useMemo(() => {
    if (isLoading || error || !totalStaked) {
      return "0";
    }

    const value = attoValueToNumberValue(totalStaked, "ROUND_DOWN", 0);
    if (value === null || value <= 0) {
      return "0";
    }

    if (value < 1_000) {
      return formatAmount(value, 0, true);
    }

    return formatCompactNumber(value);
  }, [totalStaked, isLoading, error]);

  return (
    <Tooltip
      content={
        <>
          Boost available per competition. Learn more about Boost{" "}
          <a
            href="https://docs.recall.network/token/staking"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-foreground hover:text-primary-foreground/80 font-semibold underline transition-all duration-200 ease-in-out"
          >
            here
          </a>
          .
        </>
      }
      className="cursor-help"
      tooltipClassName="text-secondary-foreground max-w-64"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full p-1">
          <BoostIcon className="size-4" alt="Staked" />
        </div>
        <span className="text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-yellow-500">
          {stakeValue}
        </span>
      </div>
    </Tooltip>
  );
};
