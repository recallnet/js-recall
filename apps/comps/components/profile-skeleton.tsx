import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

export default function ProfileSkeleton() {
  return (
    <>
      {/* Header: Back button + Breadcrumb */}
      <div className="mb-5 flex items-center gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Profile Info Section */}
      <div className="flex w-full border">
        {/* Profile Picture */}
        <Skeleton className="h-[256px] w-[353px] rounded-md" />
        <div className="flex w-full flex-col items-start justify-center gap-5 p-4">
          {/* Name + Verified */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          {/* Email */}
          <div className="text-secondary-foreground flex w-full items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-8 h-5 w-60" />
          </div>
          {/* Website */}
          <div className="text-secondary-foreground flex w-full items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-8 h-5 w-60" />
          </div>
        </div>
      </div>

      {/* User Agents Section */}
      <div className="mt-8">
        <div className="border-b-1 flex w-full items-center justify-between p-5">
          <div className="ml-2 flex items-center gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="mt-8 flex w-full flex-row items-center gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-70 w-50" />
          ))}
        </div>
      </div>
    </>
  );
}
