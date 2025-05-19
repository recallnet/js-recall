"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import AgentPodium from "@/components/agent-podium/index";
import BigNumberDisplay from "@/components/bignumber/index";
import { useLeaderboards } from "@/hooks/useLeaderboards";
import { AgentResponse, LeaderboardTypes } from "@/types";

import { LeaderboardTable } from "../leaderboard-table";

const categories = [
  LeaderboardTypes.ANALYSIS,
  LeaderboardTypes.DERIVATIVES,
  LeaderboardTypes.TRADING,
];

export function LeaderboardSection() {
  const [selected, setSelected] = React.useState(LeaderboardTypes.TRADING);
  const [limit, setLimit] = React.useState(10);
  const { data: leaderboard, isLoading } = useLeaderboards({});
  const toRender = React.useMemo(
    () =>
      leaderboard && leaderboard.agents
        ? leaderboard?.agents.slice(0, limit)
        : [],
    [leaderboard, limit],
  );

  return (
    <div className="mb-10">
      <div className="border-b border-gray-800 pb-5">
        <h1 className="text-primary text-[30px] font-bold">Leaderboards</h1>
      </div>
      <Tabs
        defaultValue={selected}
        className="w-full"
        onValueChange={(value: string) => {
          setSelected(value as LeaderboardTypes);
        }}
      >
        {categories.map((cat) => (
          <TabsContent
            key={cat}
            value={cat}
            className="flex w-full flex-col gap-6 pt-6"
          >
            <div className="divide-x-1 border-1 mb-10 grid grid-cols-1 divide-gray-800 border-gray-800 text-center text-gray-400 sm:grid-cols-3">
              <div className="flex items-center justify-between p-6">
                <div className="text-sm uppercase">Total Trades</div>
                {isLoading ? (
                  <Skeleton />
                ) : (
                  <div className="text-lg text-white">
                    {leaderboard?.stats?.totalTrades}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-6">
                <div className="text-sm uppercase">Active Agents</div>
                {isLoading ? (
                  <Skeleton />
                ) : (
                  <div className="text-lg text-white">
                    {leaderboard?.stats?.activeAgents}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-6">
                <div className="text-sm uppercase">Total Volume</div>
                {isLoading ? (
                  <Skeleton />
                ) : (
                  <div className="text-lg text-white">
                    <BigNumberDisplay
                      value={leaderboard?.stats?.totalVolume.toString() || "0"}
                      decimals={0}
                    />
                  </div>
                )}
              </div>
            </div>

            {isLoading ? (
              <AgentPodium className="mb-10 md:mb-1" loaded={!isLoading} />
            ) : (
              <AgentPodium
                className="mb-10 md:mb-1"
                first={leaderboard?.agents[0] as AgentResponse}
                second={leaderboard?.agents[1] as AgentResponse}
                third={leaderboard?.agents[2] as AgentResponse}
                loaded={!isLoading}
              />
            )}
          </TabsContent>
        ))}

        <h2 className="text-primary mt-10 text-2xl font-bold">All agents</h2>

        <TabsList className="h-15 mt-5 w-full border-y border-gray-800 bg-transparent">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className={cn(
                "flex h-full items-center px-5 text-sm",
                selected == cat
                  ? "bg-card text-primary border-t-1 border-white"
                  : "text-gray-500",
              )}
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {isLoading ? (
          <LeaderboardTable
            onExtend={() => setLimit((prev) => prev + 10)}
            agents={[]}
          />
        ) : (
          <LeaderboardTable
            onExtend={() => setLimit((prev) => prev + 10)}
            agents={toRender}
            loaded
          />
        )}
      </Tabs>
    </div>
  );
}
