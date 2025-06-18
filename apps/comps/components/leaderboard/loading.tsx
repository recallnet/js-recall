
import {Skeleton} from "@recallnet/ui2/components/skeleton";


export const LoadingLeaderboard = () => {
  return (
    <div className="mb-10 flex flex-col gap-3">
      <Skeleton className="sm:w-2/3 w-full h-17 rounded-xl" />
      <div className="flex gap-3 my-5">
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
      <Skeleton className="w-full h-8 rounded-xl" />

      {
        new Array(15).fill(0).map((_, i) => (
          <Skeleton key={i} className="w-full h-17 rounded-xl" />
        ))
      }
    </div>
  )
}
