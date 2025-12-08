"use client";

import Link from "next/link";

import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import { getAgentColor } from "@/utils/lab-colors";

interface ArenaDetailLeaderboardTableMobileProps {
  agents: LeaderboardAgent[];
}

export const ArenaDetailLeaderboardTableMobile: React.FC<
  ArenaDetailLeaderboardTableMobileProps
> = ({ agents }) => {
  // Calculate max score for bar scaling
  const maxPossibleScore = Math.max(...agents.map((a) => a.score), 1);
  const maxScaleScore = maxPossibleScore * 1.1;

  return (
    <div className="space-y-4">
      {/* Mobile Performance Cards */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">
          Performance Comparison
        </h3>

        {agents.map((participant, index) => {
          const barWidth = (participant.score / maxScaleScore) * 100;

          // Get colors
          const barColor = getAgentColor(participant.name);

          const cardContent = (
            <Card className="p-4 transition-colors hover:bg-gray-700/50">
              {/* Header Row - Rank, Logo, Name/Provider, Icons */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold",
                      index === 0
                        ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-900"
                        : index === 1
                          ? "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800"
                          : index === 2
                            ? "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                            : "bg-gray-700 text-gray-300",
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* Logo */}
                  <AgentAvatar
                    agent={participant}
                    size={24}
                    showHover={false}
                  />

                  {/* Name and Provider */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight text-white">
                      {participant.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Row */}
              <div className="mb-3 text-center">
                <div className="font-mono text-2xl font-bold text-white">
                  {participant.score.toFixed(0)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-3 w-full rounded-full bg-gray-800">
                {/* Main progress bar */}
                <div
                  className="h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </Card>
          );

          return (
            <Link
              key={participant.id}
              href={`/agents/${participant.id}`}
              className="block"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
