import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

export default function CompetitionsSkeleton() {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-8 flex flex-col gap-8 md:grid md:grid-cols-2 md:flex-row md:gap-6">
        <div className="flex flex-col items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-25 w-32" />
          </div>

          <Skeleton className="mb-10 h-20 w-64" />
        </div>

        <Skeleton className="h-150 w-full" />
      </div>

      <div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="flex flex-col gap-4" key={index}>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
            <hr />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="mb-8 h-64 w-full rounded-xl" />
              <Skeleton className="mb-8 h-64 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
