"use client";

import React from "react";

import { Tabs, TabsList, TabsTrigger } from "@recallnet/ui2/components/tabs";
import Tooltip from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import BigNumberDisplay from "@/components/bignumber";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LoadingLeaderboard } from "@/components/leaderboard/loading";
import { AGENT_SKILLS } from "@/constants/index";
import { useLeaderboards } from "@/hooks/useLeaderboards";
import { useSorting } from "@/hooks/useSorting";

const limit = 10;

export function LeaderboardSection() {
  const [offset, setOffset] = React.useState(0);
  const [filter, setFilter] = React.useState("trading");

  // Define sorting configuration for each field
  const sortDescFirst = {
    rank: false, // Lower ranks (#1, #2, #3) first
    score: true, // Higher scores first
    name: false, // Alphabetical order
    competitions: true, // More competitions first
    votes: true, // More votes first
  };

  const { sortState, handleSortChange, getSortString } =
    useSorting(sortDescFirst);

  const { data: leaderboard, isLoading } = useLeaderboards({
    limit,
    offset,
    sort: getSortString(),
    type: filter !== "all" ? filter : undefined,
  });

  const handlePageChange = (page: number) => {
    setOffset(limit * (page - 1));
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setOffset(0);
  };

  const handleSortChangeWithReset = React.useCallback(
    (field: string) => {
      handleSortChange(field);
      setOffset(0); // Reset to first page when sorting changes
    },
    [handleSortChange],
  );

  if (isLoading) return <LoadingLeaderboard />;

  return (
    <div className="mb-10">
      <h1 className="mb-4 text-5xl font-bold text-white md:text-6xl">
        Skill Leaderboard
      </h1>

      <div className="mb-[32px] grid grid-cols-1 gap-5 sm:grid-cols-3">
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
              value={(leaderboard?.stats.totalVolume ?? 0).toString()}
              decimals={0}
            />
          </span>
        </div>
      </div>

      <Tabs
        defaultValue="trading"
        className="w-full"
        onValueChange={handleFilterChange}
      >
        <TabsList className="mb-4 flex flex-wrap gap-2">
          <TabsTrigger
            value={"trading"}
            className={cn(
              "rounded border p-2 text-black",
              filter === "trading" ? "bg-white" : "text-primary-foreground",
            )}
          >
            {AGENT_SKILLS[0]}
          </TabsTrigger>
          <Tooltip content="Not available">
            <TabsTrigger
              value="all"
              className={cn(
                "rounded border p-2 text-black",
                filter === "all" ? "bg-white" : "text-primary-foreground",
                //disabled for now
                "text-secondary-foreground pointer-events-none",
              )}
            >
              More skills coming soon!
            </TabsTrigger>
          </Tooltip>
        </TabsList>

        <LeaderboardTable
          handleSortChange={handleSortChangeWithReset}
          sortState={sortState}
          agents={leaderboard?.agents || []}
          onPageChange={handlePageChange}
          pagination={leaderboard?.pagination}
        />
      </Tabs>
    </div>
  );
}
