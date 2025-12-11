"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

/**
 * Skeleton component for the stake page loading state.
 * Mirrors the section layout rendered by the stake page.
 */
export type StakeSkeletonProps = {
  /**
   * Whether to render the Conviction-related sections (eligibility + rewards column).
   */
  showConviction: boolean;
  /**
   * Whether to render the "Stake to get Boost!" callout section.
   */
  showStakeToBoostCallout: boolean;
};

export const StakeSkeleton: React.FunctionComponent<StakeSkeletonProps> = ({
  showConviction,
  showStakeToBoostCallout,
}) => {
  return (
    <div className="mx-auto my-20 flex max-w-screen-xl flex-col gap-20 px-4 sm:px-6 lg:px-8">
      {/* StakeSummary Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>

        <div className="bg-gray-2 border-gray-4 rounded-lg border">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_1fr] sm:gap-6">
            <div className="flex flex-col border-r p-4 sm:p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </div>

            <div className="relative flex flex-col p-4 sm:p-6">
              <div className="bg-gray-4 absolute bottom-7 right-0 top-7 hidden w-px sm:block" />
              <div className="flex w-fit flex-col sm:mx-auto">
                <Skeleton className="mb-2 h-4 w-16" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col border-r p-4 last:border-r-0 sm:p-6">
              <div className="flex w-fit flex-col sm:ml-auto">
                <Skeleton className="mb-2 h-4 w-20" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-10 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ConvictionEligibility Skeleton */}
      {showConviction ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>

          <div className="border-gray-4 relative overflow-hidden rounded-2xl border bg-black">
            <div className="relative z-10 flex flex-col gap-2 p-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="bg-gray-3 border-gray-4 flex w-auto flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-3 border-gray-4 flex w-auto flex-row items-center gap-6 rounded-xl border p-4">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* "Stake to get Boost!" Callout Skeleton */}
      {showStakeToBoostCallout ? (
        <div className="mb-20">
          <div className="mb-10">
            <Skeleton className="mb-2 h-6 w-56" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="mt-4 h-10 w-28" />
          </div>
        </div>
      ) : null}

      {/* Rewards Row Skeleton */}
      <div className="flex max-h-[400px] flex-col gap-6 sm:flex-row">
        <div className="flex-1">
          <div className="flex h-full flex-col gap-4">
            <div className="flex gap-1">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>

            <div className="border-gray-4 bg-gray-2 flex h-full flex-col gap-2 rounded-2xl border p-2">
              <div className="bg-gray-2 sticky top-0 z-10">
                <div className="flex gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="ml-auto h-4 w-20" />
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="h-full max-h-96 overflow-y-auto">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex gap-4 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-4 w-40" />
                      <div className="ml-auto flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-3 border-gray-4 mt-4 flex items-center justify-between rounded-xl border p-3">
                <Skeleton className="h-6 w-32" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {showConviction ? (
          <div className="flex-1">
            <div className="flex h-full flex-col gap-4">
              <div className="flex gap-1">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>

              <div className="border-gray-4 bg-gray-2 flex h-full min-h-0 flex-col gap-2 rounded-2xl border p-2">
                <div className="flex-1 overflow-hidden">
                  <div className="h-full overflow-y-auto">
                    <div className="bg-gray-2 sticky top-0 z-10">
                      <div className="flex gap-4 px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="ml-auto h-4 w-20" />
                      </div>
                    </div>

                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex gap-4 px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <div className="ml-auto flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-3 border-gray-4 flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-10 w-20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Active Stakes Section Skeleton */}
      <div className="flex flex-col gap-4">
        {/* Heading */}
        <div className="flex gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Stake Entries */}
        <div className="flex flex-col gap-8">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="xs:p-4 border-gray-4 bg-gray-2 rounded-lg border p-3"
            >
              <div className="flex flex-col items-stretch justify-between">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    {/* Status Pill */}
                    <Skeleton className="h-6 w-16 rounded-full" />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      {/* Amount */}
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-20" />
                      </div>

                      {/* Arrow */}
                      <Skeleton className="hidden h-4 w-4 sm:block" />

                      {/* Boost */}
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-20" />
                  </div>
                </div>

                {/* Progress Bar (for locked stakes) */}
                <div className="text-gray-6 mt-4 flex items-center justify-between gap-8 text-sm">
                  <Skeleton className="h-4 w-24" />
                  <div className="xs:flex hidden max-w-md flex-1 items-center gap-2">
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inactive Stakes Section Skeleton */}
      <div className="flex flex-col gap-4">
        {/* Heading */}
        <div className="flex gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Stake Entries */}
        <div className="flex flex-col gap-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="xs:p-4 border-gray-4 bg-gray-2 rounded-lg border p-3"
            >
              <div className="flex flex-col items-stretch justify-between">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    {/* Status Pill */}
                    <Skeleton className="h-6 w-20 rounded-full" />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      {/* Amount */}
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-20" />
                      </div>

                      {/* Arrow */}
                      <Skeleton className="hidden h-4 w-4 sm:block" />

                      {/* Boost */}
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Skeleton className="h-10 w-28" />
                </div>

                {/* Progress Bar */}
                <div className="text-gray-6 mt-4 flex items-center justify-between gap-8 text-sm">
                  <Skeleton className="h-4 w-24" />
                  <div className="xs:flex hidden max-w-md flex-1 items-center gap-2">
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
