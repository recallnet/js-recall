"use client";

import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { usePublicUserCompetitions } from "@/hooks/usePublicUser";

import { CompetitionsTable } from "../competitions-table";

interface PublicUserCompetitionsSectionProps {
  userId: string;
}

/**
 * Public competitions section component
 * Displays competitions for a user's agents (public, no authentication required)
 */
export default function PublicUserCompetitionsSection({
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
          <div className="text-secondary-foreground py-8 text-center">
            Loading...
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
