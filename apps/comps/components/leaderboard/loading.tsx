import { Skeleton } from "@recallnet/ui2/components/skeleton";

export const LoadingLeaderboard = () => {
  return (
    <div className="mb-10 flex flex-col gap-3">
      <Skeleton className="h-17 w-full rounded-xl sm:w-2/3" />
      <div className="my-5 flex gap-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <Skeleton className="h-8 w-full rounded-xl" />

      {new Array(15).fill(0).map((_, i) => (
        <Skeleton key={i} className="h-17 w-full rounded-xl" />
      ))}
    </div>
  );
};
