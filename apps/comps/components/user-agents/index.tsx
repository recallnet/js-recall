"use client";

import { Award, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { FaAward, FaTrophy } from "react-icons/fa";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/button";
import Card from "@recallnet/ui2/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { useUserAgents } from "@/hooks/useAgents";
import { Agent } from "@/types";

import BigNumberDisplay from "../bignumber";
import MirrorImage from "../mirror-image";

export default function UserAgentsSection() {
  const { data: agentsData, isLoading } = useUserAgents();
  const agents = isLoading || !agentsData?.agents ? [] : agentsData.agents;
  const nAgents = agents.length;
  let agentList = <NoAgents />;

  const agents = useMemo(
    () => (isLoading || !agentsData?.agents ? [] : agentsData.agents),
    [agentsData, isLoading],
  );

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
        agents[0]?.stats?.bestPlacement ?? {
          competitionId: "",
          rank: 0,
          score: 0,
          totalAgents: 0,
        },
      ),
    [agents],
  );

  const completedComps = useMemo(() => {
    return agents.reduce((acc, agent) => {
      return acc + (agent.stats?.completedCompetitions ?? 0);
    }, 0);
  }, [agents]);

  if (isLoading || (nAgents > 0 && nAgents <= 3))
    agentList = (
      <div
        className={cn(`flex w-full flex-col justify-around gap-8`, {
          "flex-row": nAgents == 1,
          "xs:flex-row": nAgents == 2,
          "md:flex-col": nAgents >= 3,
        })}
      >
        <div
          className={cn("flex flex-col gap-8", {
            "xs:flex-row flex-wrap": nAgents > 1,
          })}
        >
          {isLoading
            ? new Array(nAgents)
                .fill(0)
                .map((_, i) => <AgentCard key={i} agent={i} isLoading />)
            : agents.map((agent, i) => (
                <AgentCard key={i} agent={agent} isLoading={false} />
              ))}
        </div>
        <AgentsSummary
          isLoading={isLoading}
          nAgents={nAgents}
          bestPlacement={bestPlacement}
          completedComps={completedComps}
          highest={null}
        />
      </div>
    );

  if (nAgents >= 4)
    agentList = (
      <div className="flex w-full flex-col gap-10">
        <div className="flex justify-around gap-10 overflow-x-auto">
          {agents.map((agent, i) => (
            <AgentCard key={i} agent={agent} isLoading={isLoading} />
          ))}
        </div>
        <AgentsSummary
          isLoading={isLoading}
          nAgents={nAgents}
          bestPlacement={bestPlacement}
          completedComps={completedComps}
          highest={null}
        />
      </div>
    );

  return (
    <Collapsible defaultOpen className="mt-7">
      <CollapsibleTrigger>
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-2xl font-bold">Your Agents</span>
            <span className="text-secondary-foreground">({nAgents})</span>
          </div>
          <Button asChild>
            <Link href="/create-agent">{"+ ADD AGENT"}</Link>
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>{agentList}</CollapsibleContent>
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
          {`Kick things off by creating your very first AI agent. It'llstart competing and climbing the leaderboard in no time!`}
        </span>
        <Button asChild className="mt-6 w-40 whitespace-nowrap px-8 py-5">
          <Link href="/create-agent">{"+ ADD AGENT"}</Link>
        </Button>
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

const AgentsSummary: React.FunctionComponent<{
  className?: string;
  nAgents?: number;
  isLoading?: boolean;
  bestPlacement?: NonNullable<Agent["stats"]>["bestPlacement"];
  completedComps: number;
  highest: number;
}> = ({ best, nAgents = 0, isLoading, completedComps, highest, className }) => {
  const borderRules = "sm:border-l-1";

  return (
    <div
      className={cn(
        className,
        "xs:flex-row flex w-full flex-col justify-around border",
        {
          "h-95 flex-row": isLoading,
          "xs:flex-row": nAgents >= 3,
          "xs:flex-col": nAgents < 3,
        },
      )}
    >
      <div
        className={cn(
          "border-b-1 flex w-full flex-col items-start gap-2 p-8",
          borderRules,
        )}
      >
        {isLoading ? (
          <Skeleton className="w-30 h-2" />
        ) : (
          <span className="text-secondary-foreground uppercase">
            BEST PLACEMENT
          </span>
        )}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <Skeleton className="w-30 mt-2 h-5" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Trophy className="text-2xl text-yellow-500" />
                <span className="text-2xl font-semibold text-white">
                  {bestPlacement?.rank
                    ? `${toOrdinal(bestPlacement.rank)} of ${bestPlacement.totalAgents} `
                    : "N/A"}
                </span>
              </div>
              <span className="text-secondary-foreground">
                {competition?.name}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          "border-b-1 flex w-full flex-col items-start gap-2 p-8",
          borderRules,
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="w-30 h-2" />
            <Skeleton className="w-30 mt-2 h-5" />
          </>
        ) : (
          <>
            <span className="text-secondary-foreground uppercase">
              completed comps
            </span>
            <span className="text-2xl font-semibold text-white">
              {completedComps}
            </span>
          </>
        )}
      </div>
      <div
        className={cn(
          "flex w-full flex-col items-start gap-2 border p-8",
          borderRules,
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="w-30 h-2" />
            <Skeleton className="w-30 mt-2 h-5" />
          </>
        ) : (
          <>
            <span className="text-secondary-foreground uppercase">
              highest p&l
            </span>
            <span className="text-2xl font-semibold">
              {highest ? (
                <BigNumberDisplay value={highest.toString()} decimals={0} />
              ) : (
                "N/A"
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

type AgentCardProps = {
  className?: string;
  agent: Agent | number;
  isLoading: boolean;
};

export const AgentCard: React.FunctionComponent<AgentCardProps> = ({
  className,
  agent,
  isLoading,
}) => {
  const size = "min-w-70 max-w-80 md:max-w-70 h-95";
  const router = useRouter();

  if (isLoading || typeof agent === "number")
    return <Skeleton className={size} />;

  return (
    <Card
      corner="top-left"
      cropSize={50}
      onClick={() => router.push(`/agents/${agent.id}`)}
      className={cn(
        className,
        `${size} flex cursor-pointer flex-col items-center justify-center gap-2 bg-gray-800 px-5`,
      )}
    >
      <span className="text-secondary-foreground font-mono">
        {agent.walletAddress ? displayAddress(agent.walletAddress) : " "}
      </span>
      {agent.isVerified && (
        <VerificationBadge className="absolute right-3 top-3" />
      )}
      <MirrorImage
        className="mb-10"
        width={130}
        height={130}
        image={agent.imageUrl || "/default_agent.png"}
      />
      <div className="text-secondary-foreground flex w-full items-center justify-center gap-1 text-sm">
        <Award />
        <span>
          {agent.stats?.bestPlacement?.rank
            ? `${toOrdinal(agent.stats?.bestPlacement?.rank)}`
            : "N/A"}
        </span>
      </div>
      <span
        className="text-secondary-foreground w-full truncate text-center text-2xl font-bold"
        title={agent.name}
      >
        <Link href={`/agents/${agent.id}`}>{agent.name}</Link>
      </span>
      <div className="flex justify-center gap-3">
        <div className="text-secondary-foreground text-nowrap rounded border p-2">
          ROI N/A
        </div>
        <div className="text-secondary-foreground text-nowrap rounded border p-2">
          Trades {formatCompactNumber(agent.stats?.totalTrades ?? 0)}
        </div>
      </div>
    </Card>
  );
};
