import Image from "next/image";
import { useMemo } from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { useBoost } from "@/hooks/useBoost";
import { formatAmount, formatCompactNumber } from "@/utils/format";

export const Boost = () => {
  const { value, loading } = useBoost();

  const boostValue = useMemo(() => {
    if (value === null || value <= 0) {
      return "0";
    }

    if (value < 1_000_000) {
      return formatAmount(value, 0, true);
    }

    return formatCompactNumber(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full p-1">
        <Image src="/boost.svg" alt="Boost" width={16} height={16} />
      </div>
      {loading ? (
        <Skeleton className="h-3 w-20 rounded-xl bg-[#1D1F2B]" />
      ) : (
        <Tooltip content="Boost available per competition">
          <span className="text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-[#FBD362]">
            {boostValue}
          </span>
        </Tooltip>
      )}
    </div>
  );
};
