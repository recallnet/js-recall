"use client";

import { ChevronDown, ExternalLink, Info } from "lucide-react";
import { useState } from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { LeaderboardAgent } from "@/types/agent";
import {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@/types/unified-leaderboard";

import { LabLogo } from "../shared/lab-logo";

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

      {/* Leaderboard Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="w-16 p-4 text-sm font-medium text-gray-400">
                  Rank
                </th>
                <th className="p-4 text-sm font-medium text-gray-400">Name</th>
                <th className="p-4 text-sm font-medium text-gray-400">Type</th>
                <th className="p-4 text-sm font-medium text-gray-400">
                  Provider/Lab
                </th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">
                  Score
                </th>
                <th className="w-12 p-4 text-sm font-medium text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((participant, index) => {
                const isExpanded = expandedRow === participant.id;
                const isModel = participant.type === "model";

                return (
                  <tr
                    key={participant.id}
                    className="border-b border-gray-800/50 hover:bg-gray-900/50"
                  >
                    <td className="p-4">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                          index === 0
                            ? "bg-yellow-500 text-black"
                            : index === 1
                              ? "bg-gray-400 text-black"
                              : index === 2
                                ? "bg-orange-600 text-white"
                                : "bg-gray-700 text-gray-300",
                        )}
                      >
                        {index + 1}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-3">
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
                        <div>
                          <div className="font-medium text-white">
                            {participant.name}
                          </div>
                          {isModel && (
                            <div className="text-xs text-gray-400">
                              {(participant as BenchmarkModel).modelFamily}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={isModel ? "blue" : "green"}
                        className="text-xs"
                      >
                        {isModel ? "Model" : "Agent"}
                      </Badge>
                    </td>

                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {isModel
                          ? (participant as BenchmarkModel).provider
                          : "Live Trading"}
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="font-mono text-lg font-semibold text-white">
                        {participant.score.toFixed(1)}
                      </div>
                      {isModel &&
                        skill.id in (participant as BenchmarkModel).scores && (
                          <div className="text-xs text-gray-400">
                            ±
                            {((participant as BenchmarkModel).scores[skill.id]
                              ?.confidenceInterval?.[1] || 0) -
                              participant.score}
                          </div>
                        )}
                    </td>

                    <td className="p-4">
                      {isModel && (participant as BenchmarkModel).metadata && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedRow(isExpanded ? null : participant.id)
                          }
                          className="h-8 w-8 p-1"
                        >
                          <ChevronDown
                            size={16}
                            className={cn(
                              "text-gray-400 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
