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
      <div className="grid w-full grid-cols-3 grid-rows-[200px_56px] md:grid-cols-[256px_1fr_353px]">
        {/* Profile Picture */}
        <div className="xs:col-span-1 col-span-3 row-span-2 flex items-center justify-center">
          <Skeleton className="h-[110px] w-[110px] rounded-full" />
        </div>
        <div className="flex w-[617px] flex-col items-start justify-center gap-5 p-4">
          {/* Name + Verified */}
          <div className="flex items-center gap-3">
            <Skeleton className="sm:w-120 h-4 w-80" />
          </div>
          {/* Email */}
          <div className="text-secondary-foreground flex w-full items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40 sm:w-60" />
          </div>
          {/* Website */}
          <div className="text-secondary-foreground flex w-full items-center gap-4">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="w-30 h-4 sm:w-60" />
          </div>
        </div>
        <div className="flex hidden items-start md:block">
          <div className="flex p-5">
            <Skeleton className="mr-2 h-4 w-10" />
            <Skeleton className="mr-10 h-4 w-20" />
            <Skeleton className="mr-2 h-4 w-10" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="xs:flex col-span-2 hidden w-full items-center px-3">
          <Skeleton className="mr-4 h-4 w-20" />
          <Skeleton className="sm:w-70 w-30 mr-30 h-4" />
          <Skeleton className="mr-4 hidden h-4 w-20 md:block" />
          <Skeleton className="w-70 hidden h-4 md:block" />
        </div>
      </div>

      {/* User Agents Section */}
      <div className="mt-12">
        <div className="flex w-full items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-7" />
            <Skeleton className="h-4 w-60" />
            <Skeleton className="xs:block hidden h-4 w-20" />
            <Skeleton className="h-4 w-7" />
          </div>
          <Skeleton className="hidden h-4 w-32 sm:block" />
        </div>
        <div className="mt-16 flex w-full flex-row items-center justify-around gap-8">
          <Skeleton className="h-87 w-full max-w-80 rounded-[20px]" />
          <Skeleton className="h-87 xs:block hidden w-full max-w-80 rounded-[20px]" />
          <Skeleton className="h-87 hidden w-full max-w-80 rounded-[20px] sm:block" />
          <Skeleton className="h-87 hidden w-full max-w-80 rounded-[20px] md:block" />
        </div>
      </div>
    </>
  );
}
