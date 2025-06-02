"use client";

import React from "react";

import {Skeleton} from "@recallnet/ui2/components/skeleton";

import BigNumberDisplay from "@/components/bignumber";
import {LeaderboardTable} from "@/components/leaderboard-table";
import {useLeaderboards} from "@/hooks/useLeaderboards";

export function LeaderboardSection() {
  const [limit, setLimit] = React.useState(10);
  const {data: leaderboard, isLoading} = useLeaderboards({
    limit,
    offset: 0,
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
        <LeaderboardTable
          onExtend={() => setLimit((prev) => prev + 10)}
          agents={[]}
        />
      ) : (
        <LeaderboardTable
          onExtend={() => setLimit((prev) => prev + 10)}
          agents={leaderboard?.agents || []}
          loaded
        />
      )}
    </div>
  );
}
