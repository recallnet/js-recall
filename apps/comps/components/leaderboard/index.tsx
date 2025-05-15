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

import { cn } from "@/../../packages/ui2/src/lib/utils";
import { useAgents } from "@/hooks/useAgents";
import { Agent } from "@/types";

import AgentPodium from "../agent-podium/index";
import { LeaderboardTable } from "../leaderboard-table";

const categories = [
  LeaderboardTypes.ANALYSIS,
  LeaderboardTypes.DERIVATIVES,
  LeaderboardTypes.TRADING,
];

export function Leaderboard() {
  const [selected, setSelected] = React.useState(categories[0]);

  // Use the useAgents hook with sort=-score to get agents sorted by score in descending order
  const { data: agentsData, isLoading } = useAgents({ sort: "-score" });

  // Add rank to agents and get top 3 for podium
  const agentsWithRank = React.useMemo(() => {
    if (!agentsData?.agents) return [];
    return agentsData.agents.map((agent, index) => ({
      ...agent,
      rank: index + 1,
    }));
  }, [agentsData]);

  // Get top 3 agents for the podium
  const podiumAgents = React.useMemo(() => {
    // Default placeholder agents
    const defaultAgent: Agent = {
      id: "placeholder",
      name: "Agent",
      imageUrl: "/agent-image.png",
      metadata: { walletAddress: "" },
    };

    const first = agentsWithRank[0] || defaultAgent;
    const second = agentsWithRank[1] || defaultAgent;
    const third = agentsWithRank[2] || defaultAgent;

    return { first, second, third };
  }, [agentsWithRank]);

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
