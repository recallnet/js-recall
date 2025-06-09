"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import BigNumberDisplay from "@/components/bignumber";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { useLeaderboards } from "@/hooks/useLeaderboards";

const itemsByPage = 4;

export function LeaderboardSection() {
  const [page, setPage] = React.useState(0);
  const { data: leaderboard, isLoading } = useLeaderboards({
    limit: itemsByPage,
    offset: page * itemsByPage,
  });

  return (
    <div className="mb-10">
      <h1 className="text-primary mb-4 text-5xl font-bold md:text-6xl">
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
        <LeaderboardTable onPageChange={() => {}} page={1} agents={[]} />
      ) : (
        <LeaderboardTable
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
