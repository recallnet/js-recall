import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { useUserCompetitions } from "@/hooks";
import { PaginationResponse, UserCompetition } from "@/types";

import { CompetitionsTable } from "./competitions-table";

export default function UserCompetitionsSection() {
  const [sort, setSort] = useState("-startDate");
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const { data, isLoading, isFetching } = useUserCompetitions({
    offset,
    limit,
    sort,
  });
  const [allCompetitions, setAllCompetitions] = useState<UserCompetition[]>([]);

  const pagination: PaginationResponse = data?.pagination || {
    total: 0,
    limit,
    offset,
    hasMore: false,
  };
  const hasMore = !!pagination?.hasMore;

  useEffect(() => {
    if (!data?.competitions || isFetching) return;

    if (offset === 0) {
      setAllCompetitions(data.competitions);
    } else {
      setAllCompetitions((prev) => [...prev, ...data.competitions]);
    }
  }, [data?.competitions, isFetching, offset]);

  return (
    <Collapsible defaultOpen={!allCompetitions.length} className="mt-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-2xl font-bold">Your Competitions</span>
            <span className="text-secondary-foreground">
              ({allCompetitions.length})
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="text-secondary-foreground py-8 text-center">
            Loading...
          </div>
        ) : allCompetitions.length === 0 ? (
          <div className="text-secondary-foreground py-8 text-center">
            You have no competitions
          </div>
        ) : (
          <CompetitionsTable
            competitions={allCompetitions}
            onSortChange={(sort) => {
              setSort(sort);
              setOffset(0);
            }}
            onLoadMore={() => setOffset((prev) => prev + limit)}
            hasMore={hasMore}
            pagination={pagination}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
