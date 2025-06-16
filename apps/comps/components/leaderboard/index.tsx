"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { SortState } from "@recallnet/ui2/components/table";

import BigNumberDisplay from "@/components/bignumber";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { useLeaderboards } from "@/hooks/useLeaderboards";

const itemsByPage = 10;

export function LeaderboardSection() {
  const [page, setPage] = React.useState(0);
  const [sortState, setSorted] = React.useState(
    {} as Record<string, SortState>,
  );
  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `,${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const { data: leaderboard, isLoading } = useLeaderboards({
    limit: itemsByPage,
    offset: page * itemsByPage,
    sort: sortString,
  });

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return { ...sort, [field]: nxt };
    });
  }, []);

  return (
    <div className="mb-10">
      <h1 className="mb-4 text-5xl font-bold text-white md:text-6xl">
        Global Leaderboard
      </h1>
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex items-center justify-between border border-gray-700 px-6 py-3">
          <span className="text-sm font-bold uppercase text-gray-400">
            Active Agents
          </span>
          {isLoading ? (
            <Skeleton />
          ) : (
            <span className="text-lg text-white">
              {leaderboard?.stats.activeAgents}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between border border-gray-700 px-6 py-3">
          <span className="text-sm font-bold uppercase text-gray-400">
            Total Trades
          </span>
          {isLoading ? (
            <Skeleton />
          ) : (
            <span className="text-lg text-white">
              {leaderboard?.stats.totalTrades}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between border border-gray-700 px-6 py-3">
          <span className="text-sm uppercase">Volume traded</span>
          {isLoading ? (
            <Skeleton />
          ) : (
            <span className="text-lg text-white">
              <BigNumberDisplay
                value={leaderboard?.stats.totalVolume.toString() || ""}
                decimals={0}
              />
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <LeaderboardTable
          handleSortChange={handleSortChange}
          sortState={sortState}
          onPageChange={() => {}}
          page={1}
          agents={[]}
        />
      ) : (
        <LeaderboardTable
          handleSortChange={handleSortChange}
          sortState={sortState}
          onPageChange={(page) => setPage(page)}
          agents={leaderboard?.agents || []}
          page={page}
          itemsByPage={itemsByPage}
          total={leaderboard?.pagination.total}
          loaded
        />
      )}
    </div>
  );
}
