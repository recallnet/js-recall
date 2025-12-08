"use client";

import { BarChart3, Info } from "lucide-react";
import Link from "next/link";

import {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@recallnet/services/types";
import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
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

interface SkillDetailLeaderboardTableProps {
  skill: SkillDefinition;
  skillData: UnifiedSkillData;
}

type ParticipantEntry = (BenchmarkModel | LeaderboardAgent) & {
  rank: number;
  score: number;
  type: "model" | "agent";
};

export const SkillDetailLeaderboardTable: React.FC<
  SkillDetailLeaderboardTableProps
> = ({ skill, skillData }) => {
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

  // Calculate max score for bar scaling, including confidence intervals
  const maxPossibleScore = Math.max(
    ...allParticipants.map((p) => getParticipantMetrics(p, skill.id).maxScore),
    1,
  );

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
            {allParticipants.map((participant, index) => {
              const metrics = getParticipantMetrics(participant, skill.id);
              const isModel = metrics.isModel;
              const confidenceInterval = metrics.confidenceInterval;
              const barWidth = (participant.score / maxScaleScore) * 100;

              // Get lab color for models, unique color for agents
              const barColor = isModel
                ? getLabColor((participant as BenchmarkModel).provider)
                : getAgentColor(participant.name);

              // Calculate confidence range positions for models
              const confidenceLowerWidth = confidenceInterval
                ? (confidenceInterval[0] / maxScaleScore) * 100
                : 0;
              const confidenceUpperWidth = confidenceInterval
                ? (confidenceInterval[1] / maxScaleScore) * 100
                : barWidth;
              const confidenceRangeWidth =
                confidenceUpperWidth - confidenceLowerWidth;

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

                  {/* Model/Agent Name */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {isModel ? (
                      <LabLogo
                        provider={(participant as BenchmarkModel).provider}
                        size="sm"
                      />
                    ) : (
                      <AgentAvatar
                        agent={participant as LeaderboardAgent}
                        size={20}
                        showHover={false}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {participant.name}
                        </span>

                        {/* Model Statistics Icon */}
                        {isModel && (
                          <Tooltip
                            content={
                              <div className="max-w-sm space-y-3 p-4">
                                <div className="border-b border-gray-700 pb-2">
                                  <h4 className="text-sm font-medium text-white">
                                    Model Statistics
                                  </h4>
                                </div>

                                <div className="space-y-2 text-xs">
                                  {/* Provider */}
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Provider:
                                    </span>
                                    <span className="font-medium text-white">
                                      {(participant as BenchmarkModel).provider}
                                    </span>
                                  </div>

                                  {/* Model Family */}
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Family:
                                    </span>
                                    <span className="text-white">
                                      {
                                        (participant as BenchmarkModel)
                                          .modelFamily
                                      }
                                    </span>
                                  </div>

                                  {/* Context Length */}
                                  {(participant as BenchmarkModel)
                                    .context_length && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">
                                        Context:
                                      </span>
                                      <span className="text-white">
                                        {(
                                          participant as BenchmarkModel
                                        ).context_length!.toLocaleString()}{" "}
                                        tokens
                                      </span>
                                    </div>
                                  )}

                                  {/* Architecture */}
                                  {(participant as BenchmarkModel).architecture
                                    ?.tokenizer && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">
                                        Tokenizer:
                                      </span>
                                      <span className="text-white">
                                        {
                                          (participant as BenchmarkModel)
                                            .architecture!.tokenizer
                                        }
                                      </span>
                                    </div>
                                  )}

                                  {/* Input Modalities */}
                                  {(participant as BenchmarkModel).architecture
                                    ?.input_modalities && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">
                                        Input:
                                      </span>
                                      <span className="text-white">
                                        {(
                                          participant as BenchmarkModel
                                        ).architecture!.input_modalities.join(
                                          ", ",
                                        )}
                                      </span>
                                    </div>
                                  )}

                                  {/* Pricing */}
                                  {(participant as BenchmarkModel).pricing && (
                                    <div className="space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">
                                          Input Price:
                                        </span>
                                        <span className="text-green-400">
                                          $
                                          {
                                            (participant as BenchmarkModel)
                                              .pricing!.prompt
                                          }
                                          /1M tokens
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">
                                          Output Price:
                                        </span>
                                        <span className="text-green-400">
                                          $
                                          {
                                            (participant as BenchmarkModel)
                                              .pricing!.completion
                                          }
                                          /1M tokens
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Creation Date */}
                                  {(participant as BenchmarkModel).created && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">
                                        Created:
                                      </span>
                                      <span className="text-white">
                                        {new Date(
                                          (participant as BenchmarkModel)
                                            .created! * 1000,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            }
                          >
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="flex h-4 w-4 cursor-help touch-manipulation items-center justify-center rounded-full bg-gray-700/50 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-gray-900 active:bg-gray-600"
                              aria-label={`View statistics for ${(participant as BenchmarkModel).name}`}
                              type="button"
                            >
                              <BarChart3 size={10} />
                            </button>
                          </Tooltip>
                        )}

                        {/* NEW badge for recent models */}
                        {isModel &&
                          (participant as BenchmarkModel).created &&
                          new Date(
                            (participant as BenchmarkModel).created! * 1000, // Convert unix timestamp to milliseconds
                          ) >
                            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                            <Badge className="bg-blue-600 text-xs text-white">
                              NEW
                            </Badge>
                          )}
                        {/* Notice tooltip for evaluation warnings/info */}
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
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                                <Info size={10} />
                              </div>
                            </Tooltip>
                          )}
                      </div>
                      {isModel && (
                        <div className="text-xs text-gray-400">
                          {(participant as BenchmarkModel).provider}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold text-white">
                      {participant.score.toFixed(0)}
                      {confidenceInterval && (
                        <span className="ml-1 text-xs text-gray-400">
                          ±
                          {(
                            confidenceInterval[1] - confidenceInterval[0]
                          ).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              const barSection = (
                <>
                  {/* Horizontal Bar */}
                  <div className="mb-2 ml-10">
                    <div className="relative h-6 w-full rounded-full bg-gray-800">
                      {/* Confidence interval range */}
                      {confidenceInterval && (
                        <div
                          className="absolute h-6 rounded-full bg-white opacity-30 transition-all duration-300 ease-out"
                          style={{
                            left: `${confidenceLowerWidth}%`,
                            width: `${Math.max(confidenceRangeWidth, 1)}%`,
                          }}
                        />
                      )}

                      {/* Main score bar */}
                      <div
                        className="relative h-6 rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.max(barWidth, 2)}%`, // Minimum 2% width for visibility
                          backgroundColor: barColor,
                        }}
                      />

                      {/* Confidence interval markers */}
                      {confidenceInterval && (
                        <>
                          {/* Lower bound marker */}
                          <div
                            className="absolute top-0 h-6 w-0.5 bg-white opacity-60"
                            style={{
                              left: `${confidenceLowerWidth}%`,
                            }}
                          />
                          {/* Upper bound marker */}
                          <div
                            className="absolute top-0 h-6 w-0.5 bg-white opacity-60"
                            style={{
                              left: `${confidenceUpperWidth}%`,
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </>
              );

              return (
                <div key={participant.id} className="group">
                  {isModel ? (
                    <a
                      href={`https://openrouter.ai/models/${participant.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-2 py-1 transition-colors hover:bg-gray-700/50"
                    >
                      {rowContent}
                      {barSection}
                    </a>
                  ) : (
                    <Link
                      href={`/agents/${participant.id}`}
                      className="block rounded-lg px-2 py-1 transition-colors hover:bg-gray-700/50"
                    >
                      {rowContent}
                      {barSection}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};
