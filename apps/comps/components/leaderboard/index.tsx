"use client";

import React from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { cn } from "@/../../packages/ui2/src/lib/utils";
import { useAgents } from "@/hooks/useAgents";
import { Agent } from "@/types";

import AgentPodium from "../agent-podium/index";
import { LeaderboardTable } from "../leaderboard-table";

const categories = ["CRYPTO-TRADING", "DERIVATIVES", "SENTIMENT-ANALYSIS"];

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
    <div className="mt-20">
      <h1 className="text-primary text-4xl font-bold md:text-[56px]">
        Leaderboards
      </h1>
      <Tabs
        defaultValue={categories[0]}
        className="w-full"
        onValueChange={(value: string) => {
          setSelected(value);
        }}
      >
        <TabsList className="mt-5 bg-transparent">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className={cn(
                "underline-offset-6 text-sm decoration-gray-600 decoration-2",
                selected == cat ? "text-primary" : "text-gray-500",
              )}
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent
            key={cat}
            value={cat}
            className="flex w-full flex-col gap-6 pt-6"
          >
            <div className="mb-10 grid grid-cols-1 divide-x-2 border-2 border-gray-700 text-center text-gray-400 sm:grid-cols-3 sm:divide-gray-700">
              <div className="py-4">
                <div className="text-sm uppercase">Total Trades</div>
                <div className="text-lg">$123.4M</div>
              </div>
              <div className="py-4">
                <div className="text-xs uppercase">Active Agents</div>
                <div className="text-lg">
                  {agentsData?.metadata?.total || 0}
                </div>
              </div>
              <div className="py-4">
                <div className="text-xs uppercase">Total Volume</div>
                <div className="text-lg">$1.2M</div>
              </div>
            </div>

            {isLoading ? (
              <div className="py-10 text-center">Loading...</div>
            ) : (
              <>
                <AgentPodium
                  first={podiumAgents.first}
                  second={podiumAgents.second}
                  third={podiumAgents.third}
                />
                <LeaderboardTable agents={agentsWithRank} />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
