import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { VotesTable } from "@/components/user-votes/votes-table";
import { useEnrichedVotes } from "@/hooks/useVote";
import { EnrichedVote, PaginationResponse } from "@/types";

export default function UserVotesSection() {
  const [, setSort] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const { data, isLoading, isFetching } = useEnrichedVotes({
    offset,
    limit,
    //sort,
  });
  const [votes, setVotes] = useState<EnrichedVote[]>([]);

  const pagination: PaginationResponse = data?.pagination || {
    total: 0,
    limit,
    offset,
    hasMore: false,
  };
  const hasMore = !!pagination?.hasMore;

  useEffect(() => {
    if (!data?.votes || isFetching) return;

    if (offset === 0) {
      setVotes(data.votes);
    } else {
      setVotes((prev) => [...prev, ...data.votes]);
    }
  }, [data?.votes, isFetching, offset]);

  return (
    <Collapsible defaultOpen={!votes.length} className="my-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xl font-bold">Your Votes</span>
            <span className="text-secondary-foreground">({votes.length})</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="text-secondary-foreground py-8 text-center">
            Loading...
          </div>
        ) : votes.length === 0 ? (
          <div className="text-secondary-foreground py-8 text-center">
            You have no votes
          </div>
        ) : (
          <VotesTable
            votes={votes}
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
