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
      <div className="h-145 relative mr-8 mt-5">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
};
