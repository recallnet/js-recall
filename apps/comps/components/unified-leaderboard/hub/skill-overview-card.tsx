"use client";

import { ArrowRight, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { SkillOverviewCardProps } from "@/types/unified-leaderboard";

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
          "bg-card hover:bg-card/80 group flex h-full w-full cursor-pointer flex-col transition-all",
          "border border-transparent hover:border-gray-700",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-white">{skill.name}</h3>
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
            size={20}
            className="text-gray-400 transition-transform group-hover:translate-x-1"
          />
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="line-clamp-2 text-sm text-gray-400">
            {skill.description}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 px-6 pb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-500" />
            <span className="text-sm text-gray-300">
              {stats.totalParticipants} {isTrading ? "agents" : "models"}
            </span>
          </div>

          {stats.topScore && (
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-gray-500" />
              <span className="text-sm text-gray-300">
                Top:{" "}
                {typeof stats.topScore === "number"
                  ? stats.topScore.toFixed(1)
                  : stats.topScore}
              </span>
            </div>
          )}
        </div>

        {/* Top Participants */}
        {topParticipants.length > 0 && (
          <div className="border-t border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">
                Top {isTrading ? "Agents" : "Models"}
              </span>
              <div className="flex items-center gap-2">
                {topParticipants.slice(0, 3).map((participant, index) => {
                  if ("imageUrl" in participant) {
                    // Agent
                    return (
                      <AgentAvatar
                        key={participant.id}
                        agent={participant}
                        size={24}
                        showHover={false}
                        showRank={true}
                        rank={index + 1}
                      />
                    );
                  } else {
                    // Model
                    return (
                      <div
                        key={participant.id}
                        className="flex items-center gap-1"
                      >
                        <LabLogo
                          provider={participant.provider}
                          size="sm"
                          className={cn(
                            "rounded-full border-2",
                            index === 0
                              ? "border-trophy-first"
                              : index === 1
                                ? "border-trophy-second"
                                : "border-trophy-third",
                          )}
                        />
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        )}
      </Card>
    </Link>
  );
};
