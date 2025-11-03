import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { ChartSkeleton } from "./timeline-chart/chart-skeleton";

export default function CompetitionSkeleton() {
  return (
    <>
      {/* Breadcrumb skeleton */}
      <div className="mb-12 mt-4 flex items-center gap-3">
        <Skeleton className="h-4 w-16 rounded-xl" />
        <Skeleton className="h-4 w-24 rounded-xl" />
        <Skeleton className="h-4 w-32 rounded-xl" />
      </div>

      {/* Chart and Key grid layout */}
      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left: Timeline chart */}
        <div className="md:col-span-2">
          {/* Tab filters */}
          <Skeleton className="h-10 w-1/2 rounded-xl" />
          <ChartSkeleton />
        </div>
        {/* Right: Key + actions */}
        <div className="md:col-span-1">
          {/* Tab filters */}
          <Skeleton className="mb-6 h-10 w-1/2 rounded-xl" />
          <div className="h-145 flex flex-col">
            <div className="flex-1 border p-6">
              <div className="mb-4">
                <Skeleton className="mb-2 h-3 w-20 rounded-xl" />
                <Skeleton className="h-4 w-40 rounded-xl" />
              </div>
              <div className="mb-4">
                <Skeleton className="mb-2 h-3 w-20 rounded-xl" />
                <Skeleton className="h-4 w-32 rounded-xl" />
              </div>
              <div className="mb-4">
                <Skeleton className="mb-2 h-3 w-28 rounded-xl" />
                <Skeleton className="h-4 w-24 rounded-xl" />
              </div>
              <div className="mb-2">
                <Skeleton className="mb-2 h-3 w-24 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full rounded-xl" />
                  <Skeleton className="h-3 w-5/6 rounded-xl" />
                  <Skeleton className="h-3 w-2/3 rounded-xl" />
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <Skeleton className="h-3 w-3/4 rounded-xl" />
                <Skeleton className="h-3 w-2/3 rounded-xl" />
                <Skeleton className="h-3 w-1/2 rounded-xl" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex w-full gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Standings table skeleton */}
      <div className="mt-20 md:mt-40">
        <Skeleton className="mb-4 h-10 w-40 rounded-xl" />
        <Skeleton className="w-50 mb-4 h-5 rounded-xl" />
        <Skeleton className="w-50 mb-4 h-5 rounded-xl" />
        <div className="rounded-xl border">
          <div className="flex items-center gap-3 border-b p-4">
            <Skeleton className="h-4 w-24 rounded-xl" />
            <Skeleton className="h-4 w-24 rounded-xl" />
            <Skeleton className="ml-auto h-8 w-32 rounded-xl" />
          </div>
          <div className="p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b py-3 last:border-b-0"
              >
                <div className="h-8 w-8 rounded-full bg-gray-800" />
                <Skeleton className="h-4 w-56 rounded-xl" />
                <Skeleton className="ml-auto h-4 w-16 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
