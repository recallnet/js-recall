
"use client";

import {Skeleton} from "@recallnet/ui2/components/skeleton";
import {cn} from "@recallnet/ui2/lib/utils";

export const LoadingAgentProfile = () => {
  const rounded = 'rounded-3xl'

  return (
    <>
      <div className="w-full flex gap-2 mb-6">
        <Skeleton className="h-[10px] rounded-full w-7 mr-2" />
        <Skeleton className="h-[10px] rounded-full w-10" />
        <Skeleton className="h-[10px] rounded-full w-5" />
        <Skeleton className="h-[10px] rounded-full w-20" />
        <Skeleton className="h-[10px] rounded-full w-5" />
        <Skeleton className="h-[10px] rounded-full w-20" />
      </div>
      <div className="w-full border-t border-gray-900"></div>

      <div className="xs:grid-rows-[45vh_1fr] my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl md:grid-cols-[400px_1fr_1fr] gap-5">
        <Skeleton className={cn("w-full row-span-2 h-full", rounded)} />
        <div className="xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 col-span-3 row-start-2 mt-5 lg:col-span-1 lg:col-start-2 grid grid-rows-4 grid-cols-2 gap-5">
          <Skeleton className={cn("col-span-2 row-span-2 w-full h-full", rounded)} />
          <Skeleton className={cn("col-span-2 w-full h-full", rounded)} />
          <Skeleton className={cn("w-full h-full", rounded)} />
          <Skeleton className={cn("w-full h-full", rounded)} />
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 text-sm lg:col-start-3 lg:row-start-1 lg:mt-0 lg:grid-rows-2 gap-5">
          <Skeleton className={cn("w-full h-full", rounded)} />
          <Skeleton className={cn("w-full h-full", rounded)} />
        </div>
      </div>

      <div className="mt-10 grid grid-row-8 gap-4">
        <Skeleton className={cn("w-15 h-[10px] mb-4", rounded)} />
        <div className="w-full flex gap-2 mb-6">
          <Skeleton className="h-[10px] rounded-full w-5" />
          <Skeleton className="h-[10px] rounded-full w-20" />
          <Skeleton className="h-[10px] rounded-full w-5" />
          <Skeleton className="h-[10px] rounded-full w-20" />
        </div>
        <Skeleton className={cn("w-full h-5 mb-5", rounded)} />
        <Skeleton className={cn("w-full h-10", rounded)} />
        <Skeleton className={cn("w-full h-10", rounded)} />
        <Skeleton className={cn("w-full h-10", rounded)} />
        <Skeleton className={cn("w-full h-10", rounded)} />
      </div>
    </>
  );
}
