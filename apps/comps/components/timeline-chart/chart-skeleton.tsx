"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

/**
 * Skeleton component for TimelineChart loading state
 */
export const ChartSkeleton = () => {
  return (
    <div className="w-full">
      {/* Chart area skeleton */}
      <div className="h-120 relative p-6">
        <Skeleton className="h-full w-full" />
      </div>

      {/* Legend area skeleton */}
      <div className="border-t-1 p-5">
        {/* Search input skeleton */}
        <div className="mb-4 max-w-[500px]">
          <Skeleton className="h-10 w-full rounded-full" />
        </div>

        {/* Agent grid skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2 p-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
