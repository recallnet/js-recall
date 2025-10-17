import { skipToken, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { useSession } from "@/hooks/useSession";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

import { CompetitionsTable } from "./competitions-table";

export default function UserCompetitionsSection() {
  const [sort, setSort] = useState("-startDate");
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const { isAuthenticated } = useSession();

  const { data, isLoading, isFetching } = useQuery(
    tanstackClient.user.getCompetitions.queryOptions({
      input: isAuthenticated
        ? {
            limit,
            offset,
            sort,
          }
        : skipToken,
      placeholderData: (prev) => prev,
    }),
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
  }, [data?.competitions, isFetching, offset]);

  return (
    <Collapsible defaultOpen={!allCompetitions.length} className="mt-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xl font-bold">Your Competitions</span>
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
            pagination={data!.pagination}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
