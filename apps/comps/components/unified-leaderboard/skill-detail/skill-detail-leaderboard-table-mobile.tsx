"use client";

import { BarChart3, Info } from "lucide-react";
import { useState } from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@/types/leaderboard";
import { getAgentColor, getLabColor } from "@/utils/lab-colors";

import { LabLogo } from "../shared/lab-logo";

// Helper function to extract participant metrics
const getParticipantMetrics = (
  participant: ParticipantEntry,
  skillId: string,
) => {
  const isModel = participant.type === "model";
  let maxScore = participant.score;
  let confidenceInterval: [number, number] | undefined;

  if (isModel && skillId in (participant as BenchmarkModel).scores) {
    const scoreData = (participant as BenchmarkModel).scores[skillId];
    confidenceInterval = scoreData?.confidenceInterval;
    maxScore = confidenceInterval ? confidenceInterval[1] : participant.score;
  }

  return { maxScore, confidenceInterval, isModel };
};

interface SkillDetailLeaderboardTableMobileProps {
  skill: SkillDefinition;
  skillData: UnifiedSkillData;
}

type ParticipantEntry = (BenchmarkModel | LeaderboardAgent) & {
  rank: number;
  score: number;
  type: "model" | "agent";
};

export const SkillDetailLeaderboardTableMobile: React.FC<
  SkillDetailLeaderboardTableMobileProps
> = ({ skill, skillData }) => {
  const [showType, setShowType] = useState<"all" | "models" | "agents">("all");

  // Combine and rank all participants
  const allParticipants: ParticipantEntry[] = [
    ...skillData.participants.models.map((model, index) => ({
      ...model,
      rank: model.scores[skill.id]?.rank || index + 1,
      score: model.scores[skill.id]?.rawScore || 0,
      type: "model" as const,
    })),
    ...skillData.participants.agents.map((agent, index) => ({
      ...agent,
      rank: index + skillData.participants.models.length + 1,
      score: agent.score,
      type: "agent" as const,
    })),
  ].sort((a, b) => b.score - a.score);

  // Apply filters
  const filteredParticipants = allParticipants.filter((participant) => {
    if (showType === "all") return true;
    if (showType === "models") return participant.type === "model";
    if (showType === "agents") return participant.type === "agent";
    return true;
  });

  // Calculate max score for bar scaling
  const maxPossibleScore = Math.max(
    ...filteredParticipants.map(
      (p) => getParticipantMetrics(p, skill.id).maxScore,
    ),
    1,
  );
  const maxScaleScore = maxPossibleScore * 1.1;

  return (
    <div className="space-y-4">
      {/* Mobile Filters - Horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            showType === "all"
              ? "bg-white text-black"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700",
          )}
          onClick={() => setShowType("all")}
        >
          All ({allParticipants.length})
        </button>
        <button
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            showType === "models"
              ? "bg-white text-black"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700",
          )}
          onClick={() => setShowType("models")}
        >
          Models ({skillData.stats.modelCount})
        </button>
        <button
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            showType === "agents"
              ? "bg-white text-black"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700",
          )}
          onClick={() => setShowType("agents")}
        >
          Agents ({skillData.stats.agentCount})
        </button>
      </div>

      {/* Mobile Performance Cards */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">
          Performance Comparison
        </h3>

        {filteredParticipants.map((participant, index) => {
          const metrics = getParticipantMetrics(participant, skill.id);
          const isModel = metrics.isModel;
          const confidenceInterval = metrics.confidenceInterval;
          const barWidth = (participant.score / maxScaleScore) * 100;

          // Get colors
          const barColor = isModel
            ? getLabColor((participant as BenchmarkModel).provider)
            : getAgentColor(participant.name);

          return (
            <Card key={participant.id} className="p-4">
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
                  {isModel ? (
                    <LabLogo
                      provider={(participant as BenchmarkModel).provider}
                      size="sm"
                    />
                  ) : (
                    <AgentAvatar
                      agent={participant as LeaderboardAgent}
                      size={24}
                      showHover={false}
                    />
                  )}

                  {/* Name and Provider */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight text-white">
                      {participant.name}
                    </div>
                    {isModel && (
                      <div className="text-xs text-gray-400">
                        {(participant as BenchmarkModel).provider}
                      </div>
                    )}
                  </div>
                </div>

                {/* Icons Row */}
                <div className="flex items-center gap-2">
                  {/* Model Statistics Icon */}
                  {isModel && (
                    <Tooltip
                      content={
                        <div className="max-w-xs space-y-2 p-3">
                          <div className="border-b border-gray-700 pb-2">
                            <h4 className="text-sm font-medium text-white">
                              Statistics
                            </h4>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Provider:</span>
                              <span className="text-white">
                                {(participant as BenchmarkModel).provider}
                              </span>
                            </div>
                            {(participant as BenchmarkModel).context_length && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Context:</span>
                                <span className="text-white">
                                  {(
                                    participant as BenchmarkModel
                                  ).context_length!.toLocaleString()}{" "}
                                  tokens
                                </span>
                              </div>
                            )}
                            {(participant as BenchmarkModel).pricing && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Price:</span>
                                <span className="text-green-400">
                                  $
                                  {
                                    (participant as BenchmarkModel).pricing!
                                      .prompt
                                  }
                                  /1M
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      }
                    >
                      <button
                        className="flex h-4 w-4 cursor-help touch-manipulation items-center justify-center rounded-full bg-gray-700/50 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-gray-300 active:bg-gray-600"
                        aria-label={`View statistics for ${(participant as BenchmarkModel).name}`}
                        type="button"
                      >
                        <BarChart3 size={10} />
                      </button>
                    </Tooltip>
                  )}

                  {/* NEW Badge */}
                  {isModel &&
                    (participant as BenchmarkModel).created &&
                    new Date((participant as BenchmarkModel).created! * 1000) >
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                      <Badge className="bg-blue-600 text-xs text-white">
                        NEW
                      </Badge>
                    )}

                  {/* Notice Icon */}
                  {isModel &&
                    skill.id in (participant as BenchmarkModel).scores &&
                    (participant as BenchmarkModel).scores[skill.id]
                      ?.notice && (
                      <Tooltip
                        content={
                          (participant as BenchmarkModel).scores[skill.id]
                            ?.notice
                        }
                      >
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                          <Info size={10} />
                        </div>
                      </Tooltip>
                    )}
                </div>
              </div>

              {/* Score Row */}
              <div className="mb-3 text-center">
                <div className="font-mono text-2xl font-bold text-white">
                  {participant.score.toFixed(1)}
                </div>
                {confidenceInterval && (
                  <div className="text-sm text-gray-400">
                    ±
                    {(confidenceInterval[1] - confidenceInterval[0]).toFixed(1)}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="relative h-3 w-full rounded-full bg-gray-800">
                {/* Confidence interval background */}
                {confidenceInterval && (
                  <div
                    className="absolute h-3 rounded-full bg-white opacity-20"
                    style={{
                      left: `${(confidenceInterval[0] / maxScaleScore) * 100}%`,
                      width: `${((confidenceInterval[1] - confidenceInterval[0]) / maxScaleScore) * 100}%`,
                    }}
                  />
                )}

                {/* Main progress bar */}
                <div
                  className="h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    backgroundColor: barColor,
                  }}
                />

                {/* Confidence interval markers */}
                {confidenceInterval && (
                  <>
                    {/* Lower bound marker */}
                    <div
                      className="absolute top-0 h-3 w-0.5 bg-white opacity-60"
                      style={{
                        left: `${(confidenceInterval[0] / maxScaleScore) * 100}%`,
                      }}
                    />
                    {/* Upper bound marker */}
                    <div
                      className="absolute top-0 h-3 w-0.5 bg-white opacity-60"
                      style={{
                        left: `${(confidenceInterval[1] / maxScaleScore) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
