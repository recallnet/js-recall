import Image from "next/image";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { useRecall } from "@/hooks/useRecall";
import { formatCompactNumber } from "@/utils/format";

export const RecallToken = () => {
  const { value, loading } = useRecall();

  return (
    <div
      className="radial-hover hover:hand flex h-full cursor-pointer items-center gap-2 p-2"
      style={
        {
          "--radial-color-start": "rgba(250, 192, 33, 0.5)",
          "--radial-color-end": "rgba(250, 192, 33, 0.00)",
        } as React.CSSProperties
      }
    >
      <div className="radial-hover-text flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 p-1">
        <Image
          src="/recall-token.svg"
          alt="Recall Token"
          width={16}
          height={16}
        />
      </div>
      {loading ? (
        <Skeleton className="radial-hover-text h-3 w-20 rounded-xl bg-[#1D1F2B]" />
      ) : (
        <span className="radial-hover-text text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-gray-100">
          {formatCompactNumber(value ?? 0)}
        </span>
      )}
    </div>
  );
};
