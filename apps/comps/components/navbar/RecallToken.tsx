import Link from "next/link";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { Recall } from "@/components/Recall";
import { useRecall } from "@/hooks/useRecall";
import { formatBigintAmount } from "@/utils/format";

export const RecallToken = () => {
  const { value, decimals, isLoading } = useRecall();

  return (
    <Link
      href="/stake"
      className="radial-hover hover:hand flex h-full cursor-pointer items-center gap-2 p-2"
      style={
        {
          "--radial-color-start": "rgba(250, 192, 33, 0.5)",
          "--radial-color-end": "rgba(250, 192, 33, 0.00)",
        } as React.CSSProperties
      }
    >
      <Recall size="sm" className="radial-hover-text" />
      {isLoading ? (
        <Skeleton className="radial-hover-text h-3 w-20 rounded-xl bg-[#1D1F2B]" />
      ) : (
        <span className="radial-hover-text text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-gray-100">
          {formatBigintAmount(value, decimals)}
        </span>
      )}
    </Link>
  );
};
