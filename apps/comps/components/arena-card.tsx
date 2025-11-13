"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
import { getAgentColor } from "@/utils/lab-colors";

interface ArenaCardProps {
  arena: RouterOutputs["arena"]["list"]["arenas"][number];
  className?: string;
}

export const ArenaCard: React.FC<ArenaCardProps> = ({ arena, className }) => {
  const skillLabel =
    arena.skill === "spot_paper_trading"
      ? "Paper Trading"
      : arena.skill === "perpetual_futures"
        ? "Perpetual Futures"
        : arena.skill;

  const hasCompetitionCount = "competitionCount" in arena;
  const competitionCount = hasCompetitionCount
    ? (arena as typeof arena & { competitionCount: number }).competitionCount
    : undefined;

  // Fetch top 3 agents for this arena
  const { data: leaderboard } = useQuery(
    tanstackClient.leaderboard.getGlobal.queryOptions({
      input: {
        arenaId: arena.id,
        limit: 3,
        offset: 0,
      },
    }),
  );

  // Fetch all competitions to find ones in this arena
  const { data: allCompetitions } = useQuery(
    tanstackClient.competitions.list.queryOptions({
      input: {
        status: "active",
        paging: { limit: 100, offset: 0, sort: "-startDate" },
      },
    }),
  );

  const { data: endedCompetitions } = useQuery(
    tanstackClient.competitions.list.queryOptions({
      input: {
        status: "ended",
        paging: { limit: 100, offset: 0, sort: "-endDate" },
      },
    }),
  );

  const { data: upcomingCompetitions } = useQuery(
    tanstackClient.competitions.list.queryOptions({
      input: {
        status: "pending",
        paging: { limit: 100, offset: 0, sort: "startDate" },
      },
    }),
  );

  const topAgents = leaderboard?.agents || [];
  const topScore = topAgents[0]?.score || 0;

  // Combine and filter to only this arena
  const allComps = [
    ...(allCompetitions?.competitions || []),
    ...(endedCompetitions?.competitions || []),
    ...(upcomingCompetitions?.competitions || []),
  ];

  const filteredComps = allComps.filter((c) => c.arenaId === arena.id);
  const totalCompetitions = filteredComps.length;
  const arenaCompetitions = filteredComps.slice(0, 4); // Show 4 if more than 5
  const remainingCount = Math.max(0, totalCompetitions - 4);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "border-green-500/50 bg-green-900/20 text-green-300";
      case "pending":
        return "border-blue-500/50 bg-blue-900/20 text-blue-300";
      case "ended":
        return "border-gray-600 bg-gray-800/50 text-gray-300";
      default:
        return "border-gray-700 bg-gray-800/50 text-gray-300";
    }
  };

  return (
    <Link href={`/arenas/${arena.id}`}>
      <Card
        cropSize={35}
        corner="bottom-right"
        className={cn(
          "bg-card hover:bg-card/90 group flex h-full w-full cursor-pointer flex-col transition-all",
          className,
        )}
      >
        {/* Header Section - Fixed height */}
        <div className="h-18 md:h-18 flex shrink-0 items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-3 pr-2">
            <h3 className="text-base font-semibold leading-tight text-white group-hover:underline md:text-lg md:leading-normal">
              {arena.name}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="gray" className="px-3 py-1 text-xs">
              {skillLabel}
            </Badge>
          </div>
        </div>

        {/* Venue Badge - Fixed height */}
        <div className="h-10 shrink-0 px-4 md:px-6">
          <div className="flex flex-wrap gap-2">
            {arena.venues && arena.venues.length > 0 && (
              <Badge variant="white" className="px-2 py-1 text-xs capitalize">
                {arena.venues.join(", ")}
              </Badge>
            )}
          </div>
        </div>

        {/* Latest Competitions - Single row, horizontal scroll */}
        <div className="shrink-0 overflow-hidden px-4 py-2 md:px-6">
          {arenaCompetitions.length > 0 ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {arenaCompetitions.map((comp) => {
                const dateLabel =
                  comp.status === "ended"
                    ? "Ended"
                    : comp.status === "active"
                      ? "Started"
                      : "Starting";

                const date =
                  comp.status === "ended"
                    ? comp.endDate
                    : comp.status === "active"
                      ? comp.startDate
                      : comp.startDate;

                const formattedDate = date
                  ? new Date(date).toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "2-digit",
                    })
                  : "";

                return (
                  <div
                    key={comp.id}
                    className={cn(
                      "flex h-fit flex-shrink-0 flex-col rounded border px-2 py-1",
                      getStatusColor(comp.status),
                    )}
                    title={`${comp.name} (${comp.status})`}
                  >
                    <div className="whitespace-nowrap text-xs">{comp.name}</div>
                    {formattedDate && (
                      <div className="whitespace-nowrap text-[10px] opacity-70">
                        {dateLabel}: {formattedDate}
                      </div>
                    )}
                  </div>
                );
              })}
              {remainingCount > 0 && (
                <div className="flex h-fit flex-shrink-0 flex-col rounded border border-gray-600 bg-gray-700/30 px-2 py-1">
                  <div className="whitespace-nowrap text-xs text-gray-400">
                    ...and {remainingCount} other{remainingCount > 1 ? "s" : ""}
                  </div>
                  <div className="text-[10px] opacity-0">&nbsp;</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <span className="text-sm text-gray-400">
                {competitionCount ?? 0} competitions
              </span>
            </div>
          )}
        </div>

        {/* Top 3 Agents - Flexible height but same starting point */}
        <div className="min-h-[200px] flex-1 border-t border-gray-800 bg-gray-900/30 p-3 md:p-4">
          <div className="space-y-2 md:space-y-3">
            {topAgents.length > 0 ? (
              topAgents.map((agent, index) => {
                const barWidth = topScore ? (agent.score / topScore) * 100 : 0;
                const barColor = getAgentColor(agent.name);

                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 rounded p-1.5 md:gap-3 md:p-2"
                  >
                    {/* Rank */}
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-gray-600 text-xs font-medium text-white">
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <AgentAvatar agent={agent} size={16} showHover={false} />

                    {/* Name */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-white md:text-sm">
                        {agent.name.length > 12
                          ? `${agent.name.substring(0, 12)}...`
                          : agent.name}
                      </div>
                      <div className="text-xs text-gray-500">agent</div>
                    </div>

                    {/* Bar */}
                    <div className="h-2 w-16 rounded-full bg-gray-800 md:w-20">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(barWidth, 5)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>

                    {/* Score */}
                    <div className="w-10 text-right font-mono text-xs text-white md:w-12 md:text-sm">
                      {agent.score.toFixed(0)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-sm text-gray-500">
                No rankings yet
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
};
