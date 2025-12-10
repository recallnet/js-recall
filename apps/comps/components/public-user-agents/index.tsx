"use client";

import Image from "next/image";
import React, { useMemo } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentCard } from "@/components/user-agents/agent-card";
import AgentsSummary from "@/components/user-agents/agents-summary";
import { usePublicUserAgents } from "@/hooks/usePublicUser";

interface PublicUserAgentsSectionProps {
  userId: string;
}

/**
 * Public agents section component
 * Displays agents owned by a user (public, no authentication required)
 */
export default function PublicUserAgentsSection({
  userId,
}: PublicUserAgentsSectionProps) {
  const { data, isLoading, error } = usePublicUserAgents(userId);
  const agents = useMemo(() => data?.agents || [], [data?.agents]);
  const nAgents = agents.length;

  const bestPlacement = useMemo(
    () =>
      agents.reduce(
        (acc, agent) => {
          if (agent.stats?.bestPlacement?.rank) {
            return agent.stats.bestPlacement.rank < acc.rank
              ? agent.stats.bestPlacement
              : acc;
          }
          return acc;
        },
        {
          competitionId: "",
          rank: Infinity,
          score: 0,
          totalAgents: 0,
        },
      ),
    [agents],
  );

  const highest = useMemo(
    () =>
      agents.reduce((acc, agent) => {
        if (agent.stats?.bestPnl) {
          return agent.stats.bestPnl > acc ? agent.stats.bestPnl : acc;
        }
        return acc;
      }, Number.MIN_SAFE_INTEGER),
    [agents],
  );

  const completedComps = useMemo(() => {
    return agents.reduce((acc, agent) => {
      return acc + (agent.stats?.completedCompetitions ?? 0);
    }, 0);
  }, [agents]);

  const renderAgentList = () => {
    if (error) {
      return (
        <div className="py-8 text-center text-red-500">
          Failed to load agents
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="text-secondary-foreground py-8 text-center">
          Loading...
        </div>
      );
    }

    if (nAgents === 0) {
      return <NoAgents />;
    }

    if (nAgents > 0 && nAgents <= 3) {
      return (
        <div
          className={cn(`flex w-full flex-col justify-around gap-4`, {
            "xs:flex-row": nAgents == 1,
            "sm:flex-row": nAgents == 2,
            "lg:flex-row": nAgents == 3,
          })}
        >
          <div
            className={cn("flex gap-6", {
              "xs:overflow-x-visible overflow-x-auto": nAgents < 3,
              "overflow-x-auto md:overflow-x-visible": nAgents == 3,
            })}
          >
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                className="h-87 min-w-64 max-w-80 flex-1"
              />
            ))}
          </div>
          <AgentsSummary
            nAgents={nAgents}
            bestPlacement={bestPlacement}
            completedComps={completedComps}
            highest={highest}
          />
        </div>
      );
    }

    // nAgents >= 4
    return (
      <div className="flex w-full flex-col gap-10">
        <div className="flex justify-around gap-10 overflow-x-auto">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              className="h-87 min-w-64 max-w-80 flex-1"
            />
          ))}
        </div>
        <AgentsSummary
          nAgents={nAgents}
          bestPlacement={bestPlacement}
          completedComps={completedComps}
          highest={highest}
        />
      </div>
    );
  };

  return (
    <Collapsible defaultOpen className="my-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xl font-bold">Agents</span>
            <span className="text-secondary-foreground">({nAgents})</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full">
        {renderAgentList()}
      </CollapsibleContent>
    </Collapsible>
  );
}

const NoAgents = () => {
  return (
    <div className="relative h-[350px] w-full">
      <div className="md:px-50 2xl:px-100 flex w-full flex-col items-center px-10 pt-10 text-center sm:px-20">
        <span className="mb-2 font-semibold">
          {"This user doesn't have any agents yet"}
        </span>
      </div>
      <Image
        src="/default_agent_2.png"
        alt="agent"
        className="pointer-events-none absolute left-[60px] top-[-70px] z-0 object-contain opacity-20 sm:opacity-35"
        width={350}
        height={350}
      />
    </div>
  );
};
