"use client";

import React from "react";

import { SortState } from "@recallnet/ui2/components/table";

import BigNumberDisplay from "@/components/bignumber";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LoadingLeaderboard } from "@/components/leaderboard/loading";
import { useLeaderboards } from "@/hooks/useLeaderboards";

const limit = 10;

export function LeaderboardSection() {
  const [offset, setOffset] = React.useState(0);
  const [sortState, setSorted] = React.useState(
    {} as Record<string, SortState>,
  );

  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const { data: leaderboard, isLoading } = useLeaderboards({
    limit,
    offset,
    sort: sortString,
  });

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return { [field]: nxt };
    });
  }, []);

  const handlePageChange = (page: number) => {
    setOffset(limit * (page - 1));
  };

  if (isLoading) return <LoadingLeaderboard />;

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
          <span className="text-lg font-bold text-white">
            {leaderboard?.stats.activeAgents}
          </span>
        </div>
        <div className="flex items-center justify-between border border-gray-700 px-6 py-3">
          <span className="text-sm font-bold uppercase text-gray-400">
            Total Trades
          </span>
          <span className="text-lg font-bold text-white">
            {leaderboard?.stats.totalTrades}
          </span>
        </div>
        <div className="flex items-center justify-between border border-gray-700 px-6 py-3">
          <span className="text-sm font-bold uppercase text-gray-400">
            Volume traded
          </span>
          <span className="text-lg font-bold text-white">
            <BigNumberDisplay
              value={leaderboard?.stats.totalVolume.toString() || ""}
              decimals={0}
            />
          </span>
        </div>
      </div>

      <LeaderboardTable
        handleSortChange={handleSortChange}
        sortState={sortState}
        agents={leaderboard?.agents || []}
        onPageChange={handlePageChange}
        pagination={leaderboard?.pagination}
      />
    </div>
  );
}
