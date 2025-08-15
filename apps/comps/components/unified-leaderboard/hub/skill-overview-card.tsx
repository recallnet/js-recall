"use client";

import { ArrowRight, Info, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { SkillOverviewCardProps } from "@/types/unified-leaderboard";
import { getLabColor } from "@/utils/lab-colors";

import { LabLogo } from "../shared/lab-logo";

export const SkillOverviewCard: React.FC<SkillOverviewCardProps> = ({
  skill,
  stats,
  topParticipants,
}) => {
  const isTrading = skill.category === "trading";

  return (
    <Link href={`/leaderboards/${skill.id}`}>
      <Card
        cropSize={35}
        corner="bottom-right"
        className={cn(
          "bg-card hover:bg-card/80 group flex w-full cursor-pointer flex-col transition-all",
          "border border-transparent hover:border-gray-700",
          "h-[450px]", // Taller to prevent cutoff
        )}
      >
        {/* Header - EXACTLY 72px */}
        <div className="h-18 flex shrink-0 items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{skill.name}</h3>
              <Badge
                className={cn(
                  "text-xs",
                  isTrading
                    ? "bg-green-900 text-green-300"
                    : "bg-blue-900 text-blue-300",
                )}
              >
                {isTrading ? "LIVE" : "BENCHMARK"}
              </Badge>
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-gray-400 transition-transform group-hover:translate-x-1"
          />
        </div>

        {/* Description - EXACTLY 80px */}
        <div className="h-20 shrink-0 overflow-hidden px-6">
          <p className="line-clamp-3 text-sm leading-relaxed text-gray-400">
            {skill.description}
          </p>
        </div>

        {/* Stats - EXACTLY 56px */}
        <div className="flex h-14 shrink-0 items-center gap-6 px-6">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-500" />
            <span className="text-sm text-gray-300">
              {stats.totalParticipants} {isTrading ? "agents" : "models"}
            </span>
          </div>

          {stats.topScore && (
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-500" />
              <span className="text-sm text-gray-300">
                Top:{" "}
                {typeof stats.topScore === "number"
                  ? stats.topScore.toFixed(1)
                  : stats.topScore}
              </span>
            </div>
          )}
        </div>

        {/* Top Participants - Simplified */}
        <div className="flex-1 border-t border-gray-800 bg-gray-900/30 p-4">
          <div className="space-y-3">
            {topParticipants.slice(0, 3).map((participant, index) => {
              // Get score for this participant
              const score = (() => {
                if ("scores" in participant && skill.id in participant.scores) {
                  return participant.scores[skill.id]?.rawScore || 0;
                }
                if ("score" in participant) {
                  return participant.score;
                }
                return 0;
              })();

              // Calculate bar width relative to top score
              const barWidth = stats.topScore
                ? (score / stats.topScore) * 100
                : 0;

              // Get participant color
              const barColor = (() => {
                if ("imageUrl" in participant) {
                  return "#10B981"; // Green for agents
                } else {
                  return getLabColor(participant.provider);
                }
              })();

              return (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 rounded p-2 hover:bg-gray-800/30"
                >
                  {/* Rank */}
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-gray-600 text-xs font-medium text-white">
                    {index + 1}
                  </div>

                  {/* Logo */}
                  {"imageUrl" in participant ? (
                    <AgentAvatar
                      agent={participant}
                      size={16}
                      showHover={false}
                    />
                  ) : (
                    <LabLogo provider={participant.provider} size="sm" />
                  )}

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <div className="truncate text-sm text-white">
                        {participant.name.length > 12
                          ? `${participant.name.substring(0, 12)}...`
                          : participant.name}
                      </div>
                      {/* Notice tooltip for evaluation warnings/info */}
                      {"provider" in participant &&
                        skill.id in participant.scores &&
                        participant.scores[skill.id]?.notice && (
                          <Tooltip
                            content={participant.scores[skill.id]?.notice}
                          >
                            <div className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                              <Info size={8} />
                            </div>
                          </Tooltip>
                        )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {"imageUrl" in participant
                        ? "agent"
                        : "provider" in participant
                          ? participant.provider
                          : ""}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-2 w-20 rounded-full bg-gray-800">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(barWidth, 5)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>

                  {/* Score */}
                  <div className="w-12 text-right font-mono text-sm text-white">
                    {score.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </Link>
  );
};
