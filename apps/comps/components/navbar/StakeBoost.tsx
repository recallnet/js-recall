import Image from "next/image";
import { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { useTotalUserStaked } from "@/hooks/staking";
import { formatAmount, formatCompactNumber } from "@/utils/format";

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
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full p-1">
        <Image
          src="/boost.svg"
          alt="Staked"
          width={16}
          height={16}
          style={{ width: "auto", height: "auto" }}
        />
      </div>
      <Tooltip content="Boost available per competition">
        <span className="text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-yellow-500">
          {stakeValue}
        </span>
      </Tooltip>
    </div>
  );
};
