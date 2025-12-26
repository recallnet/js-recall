import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

export default function CompetitionsSkeleton(): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      {/* Hero skeleton */}
      <div className="pb-16 pt-20 sm:pb-20 sm:pt-28">
        <div className="flex flex-col items-start gap-3">
          <Skeleton className="h-12 w-[400px] rounded sm:h-16 sm:w-[600px]" />
          <Skeleton className="mt-2 h-6 w-[300px] rounded sm:w-[400px]" />
          <div className="mt-8 flex gap-3 sm:mt-10 sm:gap-4">
            <Skeleton className="h-11 w-[180px] rounded-none sm:h-12 sm:w-[200px]" />
            <Skeleton className="h-11 w-[100px] rounded-none sm:h-12 sm:w-[120px]" />
          </div>
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="flex flex-col gap-4 pb-20 sm:gap-5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <CompetitionCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}

const CompetitionCardSkeleton: React.FC = () => {
  return (
    <div className="flex w-full flex-col rounded-lg border border-zinc-800 bg-[#0a0b0d] sm:flex-row sm:items-center">
      {/* Image skeleton */}
      <div className="m-4 sm:m-5">
        <Skeleton className="h-24 w-24 rounded-lg sm:h-28 sm:w-28" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 sm:px-0 sm:pb-0 sm:pr-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <Skeleton className="h-6 w-48 rounded sm:w-64" />
        <Skeleton className="h-4 w-full max-w-lg rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 px-4 py-4 sm:flex-nowrap sm:gap-0 sm:border-t-0 sm:py-0 sm:pr-5">
        <div className="flex flex-1 items-center gap-4 sm:gap-0">
          {/* Rewards */}
          <div className="flex flex-col gap-1 sm:border-l sm:border-zinc-800 sm:px-6 sm:py-4">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-5 w-12 rounded" />
          </div>
          {/* Registration */}
          <div className="flex flex-col gap-1 sm:border-l sm:border-zinc-800 sm:px-6 sm:py-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
          {/* Boosting */}
          <div className="flex flex-col gap-1 sm:border-l sm:border-zinc-800 sm:px-6 sm:py-4">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        {/* Button skeleton */}
        <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
      </div>
    </div>
  );
};
