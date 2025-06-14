
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

      <div className="grid-cols-2 xs:grid-cols-4 grid-rows-[12vh_12vh_12vh_12vh] my-6 grid sm:grid-cols-6 rounded-xl gap-5">
        <Skeleton className={cn("w-full col-span-2 row-span-4 h-full xs:block hidden", rounded)} />

        <Skeleton className={cn("col-span-2 row-span-2 w-full h-full", rounded)} />
        <Skeleton className={cn("col-span-2 row-span-2 w-full h-full sm:block hidden", rounded)} />
        <Skeleton className={cn("col-span-2 w-full h-full", rounded)} />
        <Skeleton className={cn("sm:col-span-2 sm:row-span-2 w-full h-full", rounded)} />

        <Skeleton className={cn("w-full h-full sm:block hidden", rounded)} />
        <Skeleton className={cn("w-full h-full", rounded)} />
      </div>

      <div className="mt-10 grid grid-row-8 gap-4 mb-10">
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
