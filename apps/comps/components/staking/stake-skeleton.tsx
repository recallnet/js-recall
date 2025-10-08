"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

/**
 * Skeleton component for the stake page loading state
 * Matches the structure shown in the loading state screenshot
 */
export const StakeSkeleton: React.FunctionComponent = () => {
  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
      {/* Summary Cards Skeleton */}
      <div className="mb-20 rounded-lg border border-[#212C3A] bg-gray-900">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[1fr_2fr_1fr]">
          {/* Total */}
          <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
            <Skeleton className="mb-2 h-4 w-12" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>

          {/* Locked */}
          <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
            <Skeleton className="mb-2 h-4 w-16" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-8 w-20" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>

          {/* Available */}
          <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
            <Skeleton className="mb-2 h-4 w-20" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="space-y-6">
        {/* Header Section */}
        <div className="mb-10">
          <Skeleton className="mb-2 h-6 w-80" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Active Stakes Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Stake Entries */}
          <div className="">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-[#212C3A] bg-gray-900 p-3 sm:p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                    {/* Status Pill */}
                    <Skeleton className="h-6 w-16 rounded-full" />

                    {/* Amount */}
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-6 w-20" />
                    </div>

                    {/* Arrow */}
                    <Skeleton className="h-4 w-4" />

                    {/* Boost */}
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-20" />
                  </div>
                </div>

                {/* Progress Bar (for locked stakes) */}
                <div className="mt-4 flex items-center justify-between gap-5 text-sm">
                  <Skeleton className="h-4 w-24" />
                  <div className="mx-4 flex flex-1 items-center gap-2">
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
