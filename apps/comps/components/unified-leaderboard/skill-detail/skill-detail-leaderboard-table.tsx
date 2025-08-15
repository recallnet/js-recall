"use client";

import { ExternalLink, Info } from "lucide-react";
import { useState } from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@/types/unified-leaderboard";
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
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

  // Calculate max score for bar scaling, including confidence intervals
  const maxPossibleScore = Math.max(
    ...filteredParticipants.map(
      (p) => getParticipantMetrics(p, skill.id).maxScore,
    ),
    1,
  );

  // Add 10% buffer so bars don't reach 100% width
  const maxScaleScore = maxPossibleScore * 1.1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={showType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setShowType("all")}
          >
            All ({allParticipants.length})
          </Button>
          <Button
            variant={showType === "models" ? "default" : "outline"}
            size="sm"
            onClick={() => setShowType("models")}
          >
            Models ({skillData.stats.modelCount})
          </Button>
          <Button
            variant={showType === "agents" ? "default" : "outline"}
            size="sm"
            onClick={() => setShowType("agents")}
          >
            Agents ({skillData.stats.agentCount})
          </Button>
        </div>
      </div>

      {/* Performance Comparison - Horizontal Bar Graphs */}
      <Card className="overflow-hidden">
        <div className="p-6">
          <h3 className="mb-6 text-lg font-semibold text-white">
            Performance Comparison
          </h3>
          <div className="space-y-3">
            {filteredParticipants.map((participant, index) => {
              const isExpanded = expandedRow === participant.id;
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

              return (
                <div key={participant.id} className="group">
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
                          {/* NEW badge for recent models */}
                          {isModel &&
                            (participant as BenchmarkModel).metadata?.created &&
                            new Date(
                              (participant as BenchmarkModel).metadata.created,
                            ) >
                              new Date(
                                Date.now() - 30 * 24 * 60 * 60 * 1000,
                              ) && (
                              <Badge className="bg-blue-600 text-xs text-white">
                                NEW
                              </Badge>
                            )}
                          {/* Notice tooltip for evaluation warnings/info */}
                          {isModel &&
                            skill.id in
                              (participant as BenchmarkModel).scores &&
                            (participant as BenchmarkModel).scores[skill.id]
                              ?.notice && (
                              <Tooltip
                                content={
                                  (participant as BenchmarkModel).scores[
                                    skill.id
                                  ]?.notice
                                }
                              >
                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                                  <Info size={10} />
                                </div>
                              </Tooltip>
                            )}
                          {/* Info button for expandable details */}
                          {isModel &&
                            (participant as BenchmarkModel).metadata && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedRow(
                                    isExpanded ? null : participant.id,
                                  )
                                }
                                className="h-5 w-5 p-0 opacity-0"
                              >
                                <Info size={12} className="text-gray-400" />
                              </Button>
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
                        {participant.score.toFixed(1)}
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded Model Details */}
        {expandedRow && (
          <div className="border-t border-gray-800 bg-gray-950/50 p-6">
            {(() => {
              const expandedParticipant = filteredParticipants.find(
                (p) => p.id === expandedRow,
              );
              if (!expandedParticipant || expandedParticipant.type !== "model")
                return null;

              const model = expandedParticipant as BenchmarkModel;
              const metadata = model.metadata;
              const benchmark = model.scores[skill.id];

              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Info size={20} className="text-blue-400" />
                    <h4 className="text-lg font-semibold text-white">
                      {model.name} Details
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Model Specs */}
                    <div className="space-y-3">
                      <h5 className="font-medium text-gray-300">
                        Model Specifications
                      </h5>
                      <div className="space-y-2 text-sm">
                        {metadata.parameterCount && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Parameters:</span>
                            <span className="text-white">
                              {metadata.parameterCount}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-400">Context Length:</span>
                          <span className="text-white">
                            {metadata.contextLength.toLocaleString()}
                          </span>
                        </div>
                        {metadata.architecture && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Architecture:</span>
                            <span className="text-white">
                              {metadata.architecture}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-3">
                      <h5 className="font-medium text-gray-300">
                        Pricing (per 1M tokens)
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Input:</span>
                          <span className="text-white">
                            ${metadata.pricing.input}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Output:</span>
                          <span className="text-white">
                            ${metadata.pricing.output}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Benchmark Details */}
                    {benchmark && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-300">
                          Evaluation Details
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Sample Size:</span>
                            <span className="text-white">
                              {benchmark.sampleSize || "N/A"}
                            </span>
                          </div>
                          {benchmark.contamination && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                Contamination:
                              </span>
                              <Badge
                                variant={
                                  benchmark.contamination === "none"
                                    ? "green"
                                    : "gray"
                                }
                                className={cn(
                                  "text-xs",
                                  benchmark.contamination !== "none" &&
                                    "bg-yellow-900 text-yellow-300",
                                )}
                              >
                                {benchmark.contamination}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Capabilities */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-300">Capabilities</h5>
                    <div className="flex flex-wrap gap-2">
                      {metadata.inputModalities.map((modality) => (
                        <Badge
                          key={modality}
                          variant="blue"
                          className="text-xs"
                        >
                          Input: {modality}
                        </Badge>
                      ))}
                      {metadata.outputModalities.map((modality) => (
                        <Badge
                          key={modality}
                          variant="green"
                          className="text-xs"
                        >
                          Output: {modality}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* OpenRouter Link */}
                  <div>
                    <a
                      href={`https://openrouter.ai/models/${metadata.openrouterId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink size={14} />
                      View on OpenRouter
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Card>
    </div>
  );
};
