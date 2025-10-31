"use client";

import { Info, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { BenchmarkModel } from "@recallnet/services/types";
import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import { SkillOverviewCardProps } from "@/types/leaderboard";
import { checkIsAgentSkill } from "@/utils/competition-utils";
import { getAgentColor, getLabColor } from "@/utils/lab-colors";

import { LabLogo } from "../shared/lab-logo";

// Helper functions to reduce complexity
const getParticipantScore = (
  participant: BenchmarkModel | LeaderboardAgent,
  skillId: string,
): number => {
  if ("scores" in participant && skillId in participant.scores) {
    return participant.scores[skillId]?.rawScore || 0;
  }
  if ("score" in participant) {
    return participant.score;
  }
  return 0;
};

const getParticipantColor = (
  participant: BenchmarkModel | LeaderboardAgent,
): string => {
  if ("imageUrl" in participant) {
    return getAgentColor(participant.name);
  } else {
    return getLabColor((participant as BenchmarkModel).provider);
  }
};

export const SkillOverviewCard: React.FC<SkillOverviewCardProps> = ({
  skill,
  stats,
  topParticipants,
}) => {
  const isAgentSkill = checkIsAgentSkill(skill.category);

  return (
    <Link href={`/leaderboards/${skill.id}`}>
      <Card
        cropSize={35}
        corner="bottom-right"
        className={cn(
          "bg-card hover:bg-card/90 group flex w-full cursor-pointer flex-col transition-all",
        )}
      >
        {/* Header - Mobile: flexible height, Desktop: EXACTLY 72px */}
        <div className="min-h-18 md:h-18 flex shrink-0 items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-3 pr-2">
            <h3 className="text-base font-semibold leading-tight text-white md:text-lg md:leading-normal">
              {skill.name}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Badge
              className={cn(
                "text-xs",
                isAgentSkill
                  ? "bg-green-900 text-green-300"
                  : "bg-blue-900 text-blue-300",
              )}
            >
              {isAgentSkill ? "AGENT" : "MODEL"}
            </Badge>
          </div>
        </div>

        {/* Description - Mobile: flexible height, Desktop: EXACTLY 80px */}
        <div className="min-h-16 shrink-0 overflow-hidden px-4 md:h-20 md:px-6">
          <p className="line-clamp-2 text-sm leading-relaxed text-gray-400 md:line-clamp-3">
            {skill.description}
          </p>
        </div>

        {/* Stats - Mobile: flexible height, Desktop: EXACTLY 56px */}
        <div className="flex min-h-12 shrink-0 items-center gap-4 px-4 md:h-14 md:gap-6 md:px-6">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-500" />
            <span className="text-sm text-gray-300">
              {stats.totalParticipants} {isAgentSkill ? "agents" : "models"}
            </span>
          </div>

          {stats.topScore && (
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-500" />
              <span className="text-sm text-gray-300">
                Top:{" "}
                {typeof stats.topScore === "number"
                  ? stats.topScore.toFixed(0)
                  : stats.topScore}
              </span>
            </div>
          )}
        </div>

        {/* Top Participants - Simplified */}
        <div className="flex-1 border-t border-gray-800 bg-gray-900/30 p-3 md:p-4">
          <div className="space-y-2 md:space-y-3">
            {topParticipants.slice(0, 3).map((participant, index) => {
              const score = getParticipantScore(participant, skill.id);
              const barWidth = stats.topScore
                ? (score / stats.topScore) * 100
                : 0;
              const barColor = getParticipantColor(participant);

              return (
                <div
                  key={participant.id}
                  className="flex items-center gap-2 rounded p-1.5 md:gap-3 md:p-2"
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
                  ) : "provider" in participant ? (
                    <LabLogo provider={participant.provider} size="sm" />
                  ) : null}

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <div className="truncate text-xs text-white md:text-sm">
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
                    {score.toFixed(0)}
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
