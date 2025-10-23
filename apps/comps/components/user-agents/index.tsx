"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentCard } from "@/components/user-agents/agent-card";
import AgentsSummary from "@/components/user-agents/agents-summary";
import { useAnalytics } from "@/hooks/usePostHog";
import type { RouterOutputs } from "@/rpc/router";

export default function UserAgentsSection({
  agents,
}: {
  agents: RouterOutputs["user"]["getUserAgents"]["agents"];
}) {
  const { trackEvent } = useAnalytics();
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
            {agents.map((agent, i) => (
              <AgentCard
                key={i}
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
          {agents.map((agent, i) => (
            <AgentCard
              key={i}
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
            <span className="text-xl font-bold">Your Agents</span>
            <span className="text-secondary-foreground">({nAgents})</span>
          </div>
          <Button asChild>
            <Link
              href="/create-agent"
              onClick={() => trackEvent("UserClickedAddAgentButton")}
            >
              {"+ ADD AGENT"}
            </Link>
          </Button>
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
          {"You don't have any agents yet"}
        </span>
        <span className="text-secondary-foreground">
          {`Kick things off by creating your very first AI agent. Once you're ready to compete, you can join a competition to prove your skills and climb the leaderboard!`}
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
