"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import React from "react";

import { IconButton } from "@recallnet/ui2/components/icon-button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@recallnet/ui2/components/table";

import { useAgent } from "@/hooks/useAgent";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { formatPercentage } from "@/utils/format";

import { AgentAvatar } from "./agent-avatar";
import { RankBadge } from "./agents-table/rank-badge";

interface UserVoteProps {
  agentId: string;
  competitionId: string;
  totalVotes: number;
}

export const UserVote: React.FC<UserVoteProps> = ({
  agentId,
  competitionId,
  totalVotes,
}) => {
  const { data: agentData } = useAgent(agentId);
  const { data: competitionAgentsData } = useCompetitionAgents(competitionId, {
    filter: agentData?.agent.name,
  });

  const agent = competitionAgentsData?.agents.find((a) => a.id === agentId);

  if (!agent) return null;

  return (
    <div className="mt-12 w-full">
      <h2 className="mb-5 text-2xl font-bold">Your Vote</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableBody>
            <TableRow className="flex w-full">
              <TableCell className="flex items-center">
                <RankBadge rank={agent.rank} />
              </TableCell>
              <TableCell className="flex flex-1 items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <AgentAvatar agent={agent} size={32} />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="block w-full overflow-hidden"
                    >
                      <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                        {agent.name}
                      </span>
                    </Link>
                    <span className="text-secondary-foreground block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                      {agent.description}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="flex w-[140px] items-center">
                <span className="text-secondary-foreground font-semibold">
                  {agent.portfolioValue.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })}
                </span>
              </TableCell>
              <TableCell className="flex w-[140px] items-center">
                <div className="flex flex-col">
                  <span className="text-secondary-foreground font-semibold">
                    {agent.pnlPercent >= 0 ? "+" : ""}
                    {agent.pnl.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={`text-xs ${
                      agent.pnlPercent >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    ({agent.pnlPercent >= 0 ? "+" : ""}
                    {agent.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </TableCell>
              <TableCell className="flex w-[100px] items-center">
                <div className="flex flex-col">
                  <span
                    className={`text-xs ${
                      agent.change24hPercent >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {agent.change24hPercent >= 0 ? "+" : ""}
                    {agent.change24hPercent.toFixed(2)}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="flex w-[80px] items-center justify-end">
                <div className="flex flex-col items-end">
                  <span className="text-secondary-foreground font-semibold">
                    {agent.voteCount}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({formatPercentage(agent.voteCount, totalVotes)})
                  </span>
                </div>
              </TableCell>
              <TableCell className="flex w-[70px] items-center">
                <IconButton
                  className="text-blue-500 [&:disabled]:opacity-100"
                  Icon={ArrowUp}
                  disabled
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
