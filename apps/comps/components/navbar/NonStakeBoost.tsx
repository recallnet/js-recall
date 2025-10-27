import Image from "next/image";
import { useMemo } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { config } from "@/config/public";
import { formatAmount, formatCompactNumber } from "@/utils/format";

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
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full p-1">
        <Image
          src="/boost.svg"
          alt="Boost"
          width={16}
          height={16}
          style={{ width: "auto", height: "auto" }}
        />
      </div>
      <Tooltip content="Boost available per competition">
        <span className="text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-yellow-500">
          {boostValue}
        </span>
      </Tooltip>
    </div>
  );
};
