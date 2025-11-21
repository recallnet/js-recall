"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { SkillOverviewCardSkeleton } from "@/components/unified-leaderboard/hub/skeleton";

/**
 * Skeleton for the Arenas hub page
 * Mirrors the general layout of the Leaderboards hub skeleton to keep UI consistent
 */
export const ArenasHubSkeleton: React.FC = () => {
  return (
    <div className="mt-10 space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-4 text-center">
        <Skeleton className="mx-auto h-10 w-56 rounded-xl" />
        <Skeleton className="mx-auto h-5 w-[44ch] max-w-full rounded-xl" />
      </div>

      {/* Arenas Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <SkillOverviewCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};
