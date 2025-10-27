import { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { config } from "@/config/public";
import { formatAmount, formatCompactNumber } from "@/utils/format";

import { BoostIcon } from "../BoostIcon";

export const NonStakeBoost = () => {
  const boostValue = useMemo(() => {
    const value = attoValueToNumberValue(config.boost.noStakeBoostAmount);
    if (value === null || value <= 0) {
      return "0";
    }

    if (value < 1_000_000) {
      return formatAmount(value, 0, true);
    }

    return formatCompactNumber(value);
  }, []);

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
      tooltipClassName="text-secondary-foreground"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full p-1">
          <BoostIcon className="size-4" />
        </div>
        <span className="text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-yellow-500">
          {boostValue}
        </span>
      </div>
    </Tooltip>
  );
};
