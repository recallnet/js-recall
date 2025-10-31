"use client";

import { Card } from "@recallnet/ui2/components/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

export const UnifiedLeaderboardSkeleton: React.FC = () => {
  return (
    <div className="mt-10 space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-4 text-center">
        <Skeleton className="mx-auto h-10 w-64 rounded-xl" />
        <Skeleton className="mx-auto h-5 w-[40ch] max-w-full rounded-xl" />
        <Skeleton className="mx-auto h-5 w-[20ch] max-w-full rounded-xl" />
        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="text-center">
            <Skeleton className="mx-auto h-8 w-16 rounded-xl" />
            <Skeleton className="mx-auto mt-2 h-3 w-20 rounded-xl" />
          </div>
          <div className="text-center">
            <Skeleton className="mx-auto h-8 w-16 rounded-xl" />
            <Skeleton className="mx-auto mt-2 h-3 w-24 rounded-xl" />
          </div>
          <div className="text-center">
            <Skeleton className="mx-auto h-8 w-16 rounded-xl" />
            <Skeleton className="mx-auto mt-2 h-3 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <SkillOverviewCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};

export const SkillOverviewCardSkeleton: React.FC = () => {
  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className="bg-card group flex w-full flex-col border border-transparent transition-all"
    >
      {/* Header */}
      <div className="min-h-18 md:h-18 flex shrink-0 items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-3 pr-2">
          <Skeleton className="h-5 w-40 rounded-xl" />
        </div>
        <Skeleton className="h-5 w-14 rounded-xl" />
      </div>

      {/* Description */}
      <div className="min-h-16 shrink-0 overflow-hidden px-4 md:h-20 md:px-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-5/6 rounded-xl" />
          <Skeleton className="h-4 w-2/3 rounded-xl" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex min-h-12 shrink-0 items-center gap-6 px-4 md:h-14 md:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16 rounded-xl" />
        </div>
      </div>

      {/* Top Participants preview */}
      <div className="flex-1 rounded-b-xl border-t border-gray-800 bg-gray-900/30 p-3 md:p-4">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded p-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-xl bg-gray-700" />
              <div className="size-4 rounded-full bg-gray-700" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-28 rounded-xl" />
                <Skeleton className="mt-1 h-3 w-16 rounded-xl" />
              </div>
              <div className="h-2 w-20 rounded-full bg-gray-800" />
              <Skeleton className="h-3 w-10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
