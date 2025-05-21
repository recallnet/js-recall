"use client";

import { CaretDownIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import React from "react";
import { FaAward, FaTrophy } from "react-icons/fa";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/shadcn/button";
import Card from "@recallnet/ui2/components/shadcn/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { useLeaderboards } from "@/hooks";
import { AgentResponse } from "@/types";

import BigNumberDisplay from "../bignumber";
import MirrorImage from "../mirror-image";

export default function UserAgentsSection() {
  // for now using this hook, later must be user agents
  const { data: a, isLoading } = useLeaderboards();
  const data = { ...a, agents: a?.agents.slice(0, 3) };
  const nAgents = data?.agents?.length || 0;
  let agentList = <NoAgents />;

  if (isLoading || (nAgents > 0 && nAgents <= 3))
    agentList = (
      <div
        className={cn(`mt-8 flex w-full items-center justify-around gap-8`, {
          "flex-col sm:flex-row": nAgents == 1,
          "flex-col lg:flex-row": nAgents == 2,
          "flex-col 2xl:flex-row": nAgents >= 3,
        })}
      >
        <div
          className={cn("flex gap-8", {
            "flex-col sm:flex-row": nAgents == 2,
            "flex-col lg:flex-row": nAgents >= 3,
          })}
        >
          {data?.agents?.map((agent, i) => (
            <AgentCard key={i} agent={agent} isLoading={isLoading} />
          ))}
        </div>
        <AgentsSummary
          nAgents={nAgents}
          best="1st of 2054"
          completedComps={10}
          highest={2400}
        />
      </div>
    );

  if (isLoading || nAgents >= 4)
    agentList = (
      <div className="mt-8 flex w-full flex-col gap-10">
        <div className="flex justify-around gap-10 overflow-x-auto">
          {data?.agents?.map((agent, i) => (
            <AgentCard key={i} agent={agent} isLoading={isLoading} />
          ))}
        </div>
        <AgentsSummary
          nAgents={nAgents}
          best="1st of 2054"
          completedComps={10}
          highest={2400}
        />
      </div>
    );

  return (
    <div className="flex w-full flex-col">
      <div className="border-b-1 flex w-full justify-between border-gray-700 p-5">
        <div className="flex items-center gap-2">
          <CaretDownIcon className="text-gray-500" width={35} height={35} />
          <span className="text-2xl font-bold text-white">Your Agents</span>
          <span className="text-xl text-gray-400">(1)</span>
        </div>
        <Button className="bg-sky-700 px-8 py-5 text-white hover:bg-sky-600">
          {"+ ADD AGENT"}
        </Button>
      </div>
      {agentList}
    </div>
  );
}

const NoAgents = () => {
  return (
    <div className="relative w-full">
      <div className="md:px-50 2xl:px-100 flex w-full flex-col items-center px-10 pt-10 text-center sm:px-20">
        <span className="font-semibold text-white">
          {"You don’t have any agents yet"}
        </span>
        <span className="text-gray-500">
          {`Kick things off by creating your very first AI agent. It’llstart competing and climbing the leaderboard in no time!`}
        </span>
        <Button className="mt-6 w-40 bg-sky-700 px-8 py-5 text-white hover:bg-blue-600">
          {"+ ADD AGENT"}
        </Button>
      </div>
      <Image
        src="/default_agent_2.png"
        alt="agent"
        className="pointer-events-none absolute left-[60px] top-[-90px] z-0 object-contain opacity-20 sm:opacity-35"
        width={350}
        height={350}
      />
    </div>
  );
};

const AgentsSummary: React.FunctionComponent<{
  className?: string;
  nAgents?: number;
  best: string;
  completedComps: number;
  highest: number;
}> = ({ best, nAgents = 0, completedComps, highest, className }) => {
  const borderRules = "sm:border-l-1";

  return (
    <div
      className={cn(
        className,
        "flex w-full flex-col justify-around border border-gray-700 sm:flex-row",
        {
          "2xl:flex-col": nAgents >= 3,
          "lg:flex-col": nAgents == 2,
          "sm:flex-col": nAgents == 1,
        },
      )}
    >
      <div
        className={cn(
          "border-b-1 flex w-full flex-col items-start gap-2 border-gray-700 p-8",
          borderRules,
        )}
      >
        <span className="uppercase text-gray-500">BEST PLACE M ENT</span>
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <FaTrophy className="text-yellow-500" />
          <span className="text-white">{best}</span>
        </div>
      </div>
      <div
        className={cn(
          "border-b-1 flex w-full flex-col items-start gap-2 border-gray-700 p-8",
          borderRules,
        )}
      >
        <span className="uppercase text-gray-500">completed comps</span>
        <span className="text-2xl font-semibold text-white">
          {completedComps}
        </span>
      </div>
      <div
        className={cn(
          "border-b-1 flex w-full flex-col items-start gap-2 border-gray-700 p-8",
          borderRules,
        )}
      >
        <span className="uppercase text-gray-500">highest p&l</span>
        <span className="text-2xl font-semibold">
          $<BigNumberDisplay value={highest.toString()} decimals={0} />
        </span>
      </div>
    </div>
  );
};

const AgentCard: React.FunctionComponent<{
  className?: string;
  agent: AgentResponse;
  isLoading: boolean;
}> = ({ className, agent, isLoading }) => {
  const size = "min-w-70 max-w-80 md:max-w-70 h-95";

  if (isLoading) return <Skeleton className={size} />;

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
        <FaAward /> <span>{agent.score}</span>
      </div>
      <span className="text-center text-2xl font-bold text-gray-400">
        {agent.name}
      </span>
      <div className="flex justify-center gap-3 text-gray-400">
        <div className="text-nowrap rounded border border-gray-700 p-2">
          ROI {agent.metadata.roi?.toFixed(0)}%
        </div>
        <div className="text-nowrap rounded border border-gray-700 p-2">
          Trades {agent.metadata.trades}%
        </div>
      </div>
    </Card>
  );
};
