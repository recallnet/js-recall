import Link from "next/link";
import React, { useMemo } from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { AgentCompetition } from "@/types";

import { AgentAvatar } from "../agent-avatar";
import { RankBadge } from "../agents-table/rank-badge";

interface TopLeadersListProps {
  agents: AgentCompetition[];
  isLoading: boolean;
}

export const TopLeadersList: React.FC<TopLeadersListProps> = ({
  agents,
  isLoading,
}) => {
  const topThreeAgents = useMemo(() => agents.slice(0, 3), [agents]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4 rounded-lg border-y bg-[#050507] p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="col-span-4 flex items-center gap-4">
            <Skeleton className="h-8 w-[62px] rounded-md" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-[64px] items-center justify-center rounded-lg bg-gray-900/50 p-3">
        <p className="text-gray-400">No participants yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-y bg-[#050507] p-3">
      <div className="grid grid-cols-[75px_1fr_auto_auto] gap-4">
        {topThreeAgents.map((agent) => (
          <div key={agent.id} className="hover:bg-card contents">
            <RankBadge position={agent.position} />
            <Link
              href={`/agents/${agent.id}`}
              className="flex min-w-0 items-center gap-3"
            >
              <AgentAvatar agent={agent} size={32} />
              <span
                className="text-secondary-foreground truncate font-semibold"
                title={agent.name}
              >
                {agent.name}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">P&L</span>
              <span
                className={`font-semibold ${
                  agent.pnlPercent >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                ({agent.pnlPercent >= 0 ? "+" : ""}
                {agent.pnlPercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex items-center justify-end gap-3">
              <span className="text-sm text-gray-400">VOTES</span>
              <span className="text-secondary-foreground font-semibold">
                {agent.voteCount.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
