"use client";

import React from "react";

import { Card } from "@recallnet/ui2/components/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

/**
 * Skeleton for individual arena cards
 * Matches the exact structure and heights of ArenaCard
 */
export const ArenaCardSkeleton: React.FC = () => {
  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className="bg-card flex h-full w-full flex-col"
    >
      {/* Header Section */}
      <div className="h-18 md:h-18 flex shrink-0 items-center justify-between p-4 md:p-6">
        <Skeleton className="h-5 w-40 rounded-xl" />
        <Skeleton className="h-5 w-16 rounded-xl" />
      </div>

      {/* Skill Badge */}
      <div className="h-10 shrink-0 px-4 md:px-6">
        <Skeleton className="h-6 w-32 rounded" />
      </div>

      {/* Competitions */}
      <div className="shrink-0 overflow-hidden px-4 py-2 md:px-6">
        <div className="no-scrollbar flex gap-2 pb-1">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-9 w-28 flex-shrink-0 rounded" />
          ))}
        </div>
      </div>

      {/* Top 3 Agents */}
      <div className="min-h-[200px] flex-1 border-t border-gray-800 bg-gray-900/30 p-3 md:p-4">
        <div className="space-y-2 md:space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded p-1.5 md:gap-3 md:p-2"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gray-700" />
              <div className="size-4 rounded-full bg-gray-700" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-28 rounded-xl" />
                <Skeleton className="mt-1 h-3 w-16 rounded-xl" />
              </div>
              <div className="h-2 w-16 rounded-full bg-gray-800 md:w-20" />
              <Skeleton className="h-3 w-10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/**
 * Skeleton for the Arenas hub page
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
          <ArenaCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};
