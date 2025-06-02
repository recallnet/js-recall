import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

export default function CompetitionSkeleton() {
  return (
    <>
      {/* Header: Back button + Breadcrumb */}
      <div className="mb-5 flex items-center gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:gap-6">
        <Skeleton className="h-[320px] w-full md:w-[420px]" />
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex gap-4">
            <Skeleton className="h-6 w-48 flex-1" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-32 w-full" />
          <div className="mt-2 flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="my-8 h-2 w-full bg-[#23242b]" />

      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-6 w-full" />
      <Skeleton className="mb-2 h-6 w-full" />
      <Skeleton className="mb-2 h-6 w-full" />
      <Skeleton className="mb-2 h-6 w-full" />
      <Skeleton className="mb-2 h-6 w-full" />
      <Skeleton className="h-6 w-full" />
    </>
  );
}
