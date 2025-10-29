import React from "react";

import { Card } from "@recallnet/ui2/components/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

export default function CompetitionsSkeleton() {
  return (
    <div className="container mx-auto p-4">
      {/* Hero skeleton */}
      <div className="h-120 relative left-1/2 mt-8 w-full -translate-x-1/2 transform">
        {/* Top carousel bar placeholder */}
        <Skeleton className="absolute left-[-350px] right-[-350px] top-6 h-10 rounded-xl" />

        {/* Centered title and actions */}
        <div className="flex h-full w-full items-center justify-center">
          <div className="z-20 flex translate-y-[-50px] flex-col items-center text-center">
            <Skeleton className="mb-4 h-20 w-[720px] max-w-[90vw] rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-12 w-56 rounded-xl" />
              <Skeleton className="h-12 w-40 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="my-8 flex flex-col gap-x-4 gap-y-10 md:grid md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <CompetitionCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}

const CompetitionCardSkeleton: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className={cn("bg-card group flex w-full flex-col", className)}
    >
      {/* Status banner */}
      <div className="h-10 w-full rounded-t-xl bg-gray-800" />

      <div className="flex h-full w-full">
        {/* Left column */}
        <div className="flex w-full flex-col gap-2 border-r">
          <div className="flex w-full items-start justify-between align-top">
            <div className="group inline-block p-6">
              <Skeleton className="h-8 w-56 rounded-xl" />
            </div>
            {/* Avatars placeholder */}
            <div className="pr-6 pt-6">
              <div className="flex -space-x-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-card size-8 rounded-full border-2 bg-gray-700"
                  />
                ))}
              </div>
            </div>
          </div>

          <Skeleton className="ml-6 h-6 w-28 rounded-xl" />

          <div className="px-6 py-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-xl" />
              <Skeleton className="h-4 w-5/6 rounded-xl" />
              <Skeleton className="h-4 w-2/3 rounded-xl" />
            </div>
          </div>

          {/* Top leaders avatars */}
          <div className="px-6 py-2">
            <div className="flex -space-x-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border-card size-8 rounded-full border-2 bg-gray-700"
                />
              ))}
            </div>
          </div>

          <hr />

          {/* Summary placeholder */}
          <div className="px-6 py-2">
            <Skeleton className="h-6 w-40 rounded-xl" />
          </div>

          {/* Actions */}
          <div className="px-6 pb-4">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex w-full flex-col">
          <div className="flex w-full">
            <div className="w-full border-r p-6">
              <Skeleton className="mb-2 h-3 w-20 rounded-xl" />
              <Skeleton className="h-4 w-32 rounded-xl" />
            </div>
            <div className="w-full p-6">
              <Skeleton className="mb-2 h-3 w-20 rounded-xl" />
              <Skeleton className="h-4 w-28 rounded-xl" />
              <Skeleton className="mb-2 mt-4 h-3 w-28 rounded-xl" />
              <Skeleton className="h-4 w-24 rounded-xl" />
            </div>
          </div>
          <div className="relative h-full w-full content-center overflow-hidden">
            <div className="h-60 w-full rounded-b-xl bg-gray-800" />
          </div>
        </div>
      </div>
    </Card>
  );
};
