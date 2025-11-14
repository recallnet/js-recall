"use client";

import Link from "next/link";

import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import { getAgentColor } from "@/utils/lab-colors";

interface ArenaDetailLeaderboardTableProps {
  agents: LeaderboardAgent[];
}

export const ArenaDetailLeaderboardTable: React.FC<
  ArenaDetailLeaderboardTableProps
> = ({ agents }) => {
  // Calculate max score for bar scaling
  const maxPossibleScore = Math.max(...agents.map((a) => a.score), 1);

  // Add 10% buffer so bars don't reach 100% width
  const maxScaleScore = maxPossibleScore * 1.1;

  return (
    <div className="space-y-6">
      {/* Performance Comparison - Horizontal Bar Graphs */}
      <Card className="overflow-hidden">
        <div className="p-6">
          <h3 className="mb-6 text-lg font-semibold text-white">
            Performance Comparison
          </h3>
          <div className="space-y-3">
            {agents.map((participant, index) => {
              const barWidth = (participant.score / maxScaleScore) * 100;

              // Get unique color for agents
              const barColor = getAgentColor(participant.name);

              const rowContent = (
                <div className="flex items-center gap-4 py-2">
                  {/* Rank */}
                  <div
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold",
                      index === 0
                        ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-900 shadow-md"
                        : index === 1
                          ? "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800 shadow-md"
                          : index === 2
                            ? "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 shadow-md"
                            : "bg-gray-700 text-gray-300",
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* Agent Name */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AgentAvatar
                      agent={participant}
                      size={20}
                      showHover={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {participant.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold text-white">
                      {participant.score.toFixed(0)}
                    </div>
                  </div>
                </div>
              );

              const barSection = (
                <>
                  {/* Horizontal Bar */}
                  <div className="mb-2 ml-10">
                    <div className="relative h-6 w-full rounded-full bg-gray-800">
                      {/* Main score bar */}
                      <div
                        className="relative h-6 rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.max(barWidth, 2)}%`, // Minimum 2% width for visibility
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                </>
              );

              return (
                <div key={participant.id} className="group">
                  <Link
                    href={`/agents/${participant.id}`}
                    className="block rounded-lg px-2 py-1 transition-colors hover:bg-gray-700/50"
                  >
                    {rowContent}
                    {barSection}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};
