"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { FaAward, FaTrophy } from "react-icons/fa";

import { displayAddress } from "@recallnet/address-utils/display";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import Card from "@recallnet/ui2/components/shadcn/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentResponse, ProfileResponse } from "@/types";

import BigNumberDisplay from "../bignumber";
import MirrorImage from "../mirror-image";

interface UserAgentsSectionProps {
  user: ProfileResponse["user"];
  isLoading: boolean;
}

export default function UserAgentsSection({
  user,
  isLoading,
}: UserAgentsSectionProps) {
  // for now using this hook, later must be user agents
  const nAgents = isLoading ? 2 : user?.agents?.length || 0;
  let agentList = <NoAgents />;

  if (isLoading || (nAgents > 0 && nAgents <= 3))
    agentList = (
      <div
        className={cn(
          `mt-8 flex w-full flex-col items-center justify-around gap-8`,
          {
            "sm:flex-row": nAgents == 1,
            "lg:flex-row": nAgents == 2,
            "2xl:flex-row": nAgents >= 3,
          },
        )}
      >
        <div
          className={cn("flex flex-col gap-8", {
            "sm:flex-row": nAgents == 2,
            "lg:flex-row": nAgents >= 3,
          })}
        >
          {isLoading
            ? new Array(nAgents)
                .fill(0)
                .map((_, i) => <AgentCard key={i} agent={i} isLoading />)
            : user?.agents?.map((agent, i) => (
                <AgentCard key={i} agent={agent} isLoading={false} />
              ))}
        </div>
        <AgentsSummary
          isLoading={isLoading}
          nAgents={nAgents}
          best="-"
          completedComps={0}
          highest={0}
        />
      </div>
    );

  if (nAgents >= 4)
    agentList = (
      <div className="mt-8 flex w-full flex-col gap-10">
        <div className="flex justify-around gap-10 overflow-x-auto">
          {user?.agents?.map((agent, i) => (
            <AgentCard key={i} agent={agent} isLoading={isLoading} />
          ))}
        </div>
        <AgentsSummary
          isLoading={isLoading}
          nAgents={nAgents}
          best="1st of 2054"
          completedComps={10}
          highest={2400}
        />
      </div>
    );

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="border-b-1 flex w-full p-5">
        <div className="flex w-full items-center justify-between">
          <div className="ml-2 flex items-center gap-2">
            <span className="text-2xl font-bold">Your Agents</span>
            <span className="text-secondary-foreground">({nAgents})</span>
          </div>
          <Link href="/create-agent">{"+ ADD AGENT"}</Link>
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
        <Link
          href="/create-agent"
          className="mt-6 w-40 whitespace-nowrap px-8 py-5"
        >
          {"+ ADD AGENT"}
        </Link>
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
  best: string;
  completedComps: number;
  highest: number;
}> = ({ best, nAgents = 0, isLoading, completedComps, highest, className }) => {
  const borderRules = "sm:border-l-1";

  return (
    <div
      className={cn(
        className,
        "flex w-full flex-col justify-around border sm:flex-row",
        {
          "lg:h-95 sm:flex-row": isLoading,
          "2xl:flex-col": nAgents >= 3,
          "lg:flex-col": nAgents == 2,
          "sm:flex-col": nAgents == 1,
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
          <span className="uppercase text-gray-500">BEST PLACEMENT</span>
        )}
        <div className="flex items-center gap-3 text-2xl font-semibold">
          {isLoading ? (
            <Skeleton className="w-30 mt-2 h-5" />
          ) : (
            <>
              <FaTrophy className="text-yellow-500" />
              <span className="text-white">{best}</span>
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
            <span className="uppercase text-gray-500">completed comps</span>
            <span className="text-2xl font-semibold text-white">
              {completedComps}
            </span>
          </>
        )}
      </div>
      <div
        className={cn(
          "flex w-full flex-col items-start gap-2 border-gray-700 p-8",
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
            <span className="uppercase text-gray-500">highest p&l</span>
            <span className="text-2xl font-semibold">
              $<BigNumberDisplay value={highest.toString()} decimals={0} />
            </span>
          </>
        )}
      </div>
    </div>
  );
};

type AgentCardProps = {
  className?: string;
  agent: AgentResponse | number;
  isLoading: boolean;
};

export const AgentCard: React.FunctionComponent<AgentCardProps> = ({
  className,
  agent,
  isLoading,
}) => {
  const size = "min-w-70 max-w-80 md:max-w-70 h-95";

  if (isLoading || typeof agent === "number")
    return <Skeleton className={size} />;

  return (
    <Card
      corner="top-left"
      cropSize={50}
      className={cn(
        className,
        `${size} flex flex-col items-center justify-center gap-2 bg-gray-800 px-5`,
      )}
    >
      <span className="text-gray-400">
        {displayAddress(agent.metadata.walletAddress || "")}
      </span>
      <MirrorImage
        className="mb-10"
        width={130}
        height={130}
        image="/default_agent.png"
      />
      <div className="flex w-full items-center justify-center gap-3 text-sm text-gray-400">
        <FaAward /> <span>{agent.score || "-"}</span>
      </div>
      <span className="text-center text-2xl font-bold text-gray-400">
        {agent.name}
      </span>
      <div className="flex justify-center gap-3 text-gray-400">
        <div className="text-nowrap rounded border border-gray-700 p-2">
          ROI {agent.metadata.roi?.toFixed(0) || "-"}
        </div>
        <div className="text-nowrap rounded border border-gray-700 p-2">
          Trades {agent.metadata.trades || "-"}
        </div>
      </div>
    </Card>
  );
};
