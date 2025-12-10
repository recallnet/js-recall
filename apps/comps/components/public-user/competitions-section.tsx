"use client";

import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { usePublicUserCompetitions } from "@/hooks/usePublicUser";

import { CompetitionsTable } from "../competitions-table";

interface PublicUserCompetitionsSectionProps {
  userId: string;
}

/**
 * Public competitions section component
 */
export function PublicUserCompetitionsSection({
  userId,
}: PublicUserCompetitionsSectionProps) {
  const [sort, setSort] = useState("-startDate");
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data, isLoading, isFetching, error } = usePublicUserCompetitions(
    userId,
    {
      limit,
      offset,
      sort,
    },
  );

  // Infer competition type from RPC response
  type Competition = NonNullable<typeof data>["competitions"][number];
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);

  const hasMore = data?.pagination.hasMore ?? false;

  useEffect(() => {
    if (!data?.competitions || isFetching) return;

    if (offset === 0) {
      setAllCompetitions(data.competitions);
    } else {
      setAllCompetitions((prev) => [...prev, ...data.competitions]);
    }
  }, [data?.competitions, isFetching, offset, sort]);

  return (
    <Collapsible defaultOpen className="mt-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xl font-bold">Competitions</span>
            <span className="text-secondary-foreground">
              ({allCompetitions.length})
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {error ? (
          <div className="py-8 text-center text-red-500">
            Failed to load competitions
          </div>
        ) : isLoading ? (
          <div className="mt-4 rounded-xl border">
            {/* Table header skeleton */}
            <div className="flex gap-4 border-b px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Table rows skeleton */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-4 py-4"
              >
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : data && allCompetitions.length > 0 ? (
          <CompetitionsTable
            competitions={allCompetitions}
            onSortChange={(newSort) => {
              setSort(newSort);
              setOffset(0);
              setAllCompetitions([]);
            }}
            onLoadMore={() => setOffset((prev) => prev + limit)}
            hasMore={hasMore}
            pagination={data.pagination}
          />
        ) : (
          <div className="text-secondary-foreground py-8 text-center">
            No competitions found
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
