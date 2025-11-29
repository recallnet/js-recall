import Link from "next/link";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { Recall } from "@/components/Recall";
import { useUserStakes } from "@/hooks/staking";
import { useRecall } from "@/hooks/useRecall";
import type { StakeInfoWithId } from "@/types/staking";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

export const RecallToken = () => {
  const recall = useRecall();
  const { data: stakes, isLoading: isStakesLoading } = useUserStakes();

  const decimals =
    recall.isLoading || recall.decimals === undefined ? 18 : recall.decimals;

  const availableRaw =
    recall.isLoading || recall.value === undefined ? 0n : recall.value;

  const lockedRaw =
    stakes?.reduce((acc: bigint, s: StakeInfoWithId) => acc + s.amount, 0n) ??
    0n;

  const totalRaw = availableRaw + lockedRaw;

  const available = formatBigintAmount(
    availableRaw,
    decimals,
    shouldShowCompact(availableRaw),
  );

  const total = formatBigintAmount(
    totalRaw,
    decimals,
    shouldShowCompact(totalRaw),
  );

  const isLoading = recall.isLoading || isStakesLoading;

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
        <Skeleton className="radial-hover-text h-3 w-32 rounded-xl bg-[#1D1F2B]" />
      ) : (
        <span className="radial-hover-text text-right font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px] text-gray-100">
          <span className="font-bold">{available}</span> / {total}
        </span>
      )}
    </Link>
  );
};
