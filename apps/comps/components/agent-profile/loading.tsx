"use client";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

export const LoadingAgentProfile = () => {
  const rounded = "rounded-3xl";

  return (
    <>
      <div className="mb-6 flex w-full gap-2">
        <Skeleton className="mr-2 h-[10px] w-7 rounded-full" />
        <Skeleton className="h-[10px] w-10 rounded-full" />
        <Skeleton className="h-[10px] w-5 rounded-full" />
        <Skeleton className="h-[10px] w-20 rounded-full" />
        <Skeleton className="h-[10px] w-5 rounded-full" />
        <Skeleton className="h-[10px] w-20 rounded-full" />
      </div>
      <div className="w-full border-t border-gray-900"></div>

      <div className="xs:grid-cols-4 my-6 grid grid-cols-2 grid-rows-[12vh_12vh_12vh_12vh] gap-5 rounded-xl sm:grid-cols-6">
        <Skeleton
          className={cn(
            "xs:block col-span-2 row-span-4 hidden h-full w-full",
            rounded,
          )}
        />

        <Skeleton
          className={cn("col-span-2 row-span-2 h-full w-full", rounded)}
        />
        <Skeleton
          className={cn(
            "col-span-2 row-span-2 hidden h-full w-full sm:block",
            rounded,
          )}
        />
        <Skeleton className={cn("col-span-2 h-full w-full", rounded)} />
        <Skeleton
          className={cn("h-full w-full sm:col-span-2 sm:row-span-2", rounded)}
        />

        <Skeleton className={cn("hidden h-full w-full sm:block", rounded)} />
        <Skeleton className={cn("h-full w-full", rounded)} />
      </div>

      <div className="grid-row-8 mb-10 mt-10 grid gap-4">
        <Skeleton className={cn("w-15 mb-4 h-[10px]", rounded)} />
        <div className="mb-6 flex w-full gap-2">
          <Skeleton className="h-[10px] w-5 rounded-full" />
          <Skeleton className="h-[10px] w-20 rounded-full" />
          <Skeleton className="h-[10px] w-5 rounded-full" />
          <Skeleton className="h-[10px] w-20 rounded-full" />
        </div>
        <Skeleton className={cn("mb-5 h-5 w-full", rounded)} />
        <Skeleton className={cn("h-10 w-full", rounded)} />
        <Skeleton className={cn("h-10 w-full", rounded)} />
        <Skeleton className={cn("h-10 w-full", rounded)} />
        <Skeleton className={cn("h-10 w-full", rounded)} />
      </div>
    </>
  );
};
