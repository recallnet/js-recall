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
      <div className="h-150 relative p-6">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
};
