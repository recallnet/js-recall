"use client";

import { BarChart3, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@recallnet/services/types";
import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
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
  const [selectedModel, setSelectedModel] = useState<BenchmarkModel | null>(
    null,
  );

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

  // Calculate max score for bar scaling
  const maxPossibleScore = Math.max(
    ...allParticipants.map((p) => getParticipantMetrics(p, skill.id).maxScore),
    1,
  );
  const maxScaleScore = maxPossibleScore * 1.1;

  return (
    <div className="space-y-4">
      {/* Mobile Performance Cards */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">
          Performance Comparison
        </h3>

        {allParticipants.map((participant, index) => {
          const metrics = getParticipantMetrics(participant, skill.id);
          const isModel = metrics.isModel;
          const confidenceInterval = metrics.confidenceInterval;
          const barWidth = (participant.score / maxScaleScore) * 100;

          // Get colors
          const barColor = isModel
            ? getLabColor((participant as BenchmarkModel).provider)
            : getAgentColor(participant.name);

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
                  {/* Model Stats Button (Mobile-friendly) */}
                  {isModel &&
                    (participant as BenchmarkModel).context_length && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(participant as BenchmarkModel);
                        }}
                        className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 transition-colors hover:bg-gray-200"
                      >
                        <BarChart3 size={12} className="text-gray-600" />
                        <span className="text-[10px] font-medium text-gray-700">
                          {Math.round(
                            (participant as BenchmarkModel).context_length! /
                              1000,
                          )}
                          k
                        </span>
                      </button>
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
                  {participant.score.toFixed(0)}
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

          return isModel ? (
            <a
              key={participant.id}
              href={`https://openrouter.ai/models/${participant.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {cardContent}
            </a>
          ) : (
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

      {/* Model Stats Modal */}
      <Dialog
        open={!!selectedModel}
        onOpenChange={(open) => !open && setSelectedModel(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 size={16} />
              Model Statistics
            </DialogTitle>
          </DialogHeader>
          {selectedModel && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600">Model</h4>
                <p className="text-sm">{selectedModel.name}</p>
              </div>

              {selectedModel.context_length && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600">
                    Context Length
                  </h4>
                  <p className="text-sm">
                    {selectedModel.context_length.toLocaleString()} tokens
                  </p>
                </div>
              )}

              {selectedModel.pricing && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Pricing</h4>
                  <div className="space-y-1 text-sm">
                    <p>Input: ${selectedModel.pricing.prompt} per M tokens</p>
                    <p>
                      Output: ${selectedModel.pricing.completion} per M tokens
                    </p>
                  </div>
                </div>
              )}

              {selectedModel.created && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600">
                    Released
                  </h4>
                  <p className="text-sm">
                    {new Date(
                      selectedModel.created * 1000,
                    ).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedModel.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600">
                    Description
                  </h4>
                  <p className="text-sm text-gray-700">
                    {selectedModel.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
