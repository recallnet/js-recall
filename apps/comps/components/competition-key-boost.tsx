import { Link } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { useCompetitionBoosts } from "@/hooks";
import { openForBoosting } from "@/lib/open-for-boosting";
import { RouterOutputs } from "@/rpc/router";
import { displayAddress } from "@/utils/address";
import { shouldShowRelativeTimestamp } from "@/utils/competition-utils";
import { formatDateShort } from "@/utils/format";
import { formatBigintAmount, formatRelativeTime } from "@/utils/format";

import { BoostIcon } from "./BoostIcon";
import { SkeletonList } from "./skeleton-loaders";

/**
 * BoostsTabContent component displays boost allocations for a competition
 */
export const BoostsTabContent: React.FC<{
  competition: RouterOutputs["competitions"]["getById"];
}> = ({ competition }) => {
  // If the competition is pending, only query boosts if boosting has started; else, always fetch
  const shouldFetchBoosts =
    competition.status === "pending" ? openForBoosting(competition) : true;
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useCompetitionBoosts(
    competition.id,
    25,
    shouldFetchBoosts,
    competition.status,
  );

  const boosts = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <SkeletonList count={10} type="trade" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <BoostIcon className="mb-4 size-8" />
        <p className="text-red-400">Failed to load boost predictions</p>
      </div>
    );
  }

  if (boosts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <BoostIcon className="mb-4 size-8" />
        <p className="text-sm text-gray-400">
          {competition.status === "ended"
            ? "No boosts found for this competition"
            : "No boosts yet for this competition"}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div>
        <div className="space-y-3">
          {boosts.map((boost, index) => {
            const timestamp = new Date(boost.createdAt);
            const showRelative = shouldShowRelativeTimestamp(timestamp);

            return (
              <div
                key={`${boost.userId}-${boost.agentId}-${index}`}
                className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3 last:border-0"
              >
                {/* Left column: User wallet address */}
                <div className="flex items-center gap-2">
                  <Tooltip
                    content={boost.wallet}
                    tooltipClassName="max-w-md z-999"
                  >
                    <span className="font-mono">
                      {displayAddress(boost.wallet, { numChars: 6 })}
                    </span>
                  </Tooltip>
                </div>

                {/* Right column: Agent name + Boost details */}
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs text-gray-400">
                    <Link
                      href={`/agents/${boost.agentId}`}
                      className="text-xs font-semibold hover:underline"
                    >
                      {boost.agentName}
                    </Link>
                    {" • "}
                    {formatBigintAmount(boost.amount)} BOOST
                  </span>
                  <span className="text-xs text-gray-500">
                    {showRelative
                      ? formatRelativeTime(timestamp)
                      : formatDateShort(timestamp, true)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="mt-4">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
              className="w-full"
            >
              {isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
