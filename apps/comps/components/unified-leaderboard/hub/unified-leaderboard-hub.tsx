"use client";

import { Loader2 } from "lucide-react";

import { Card } from "@recallnet/ui2/components/card";

import { useUnifiedLeaderboard } from "@/hooks/useUnifiedLeaderboard";

import { SkillOverviewCard } from "./skill-overview-card";

export const UnifiedLeaderboardHub: React.FC = () => {
  const { data, isLoading, error } = useUnifiedLeaderboard();

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="text-gray-400">Loading leaderboards...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold text-red-400">
          Error Loading Leaderboards
        </h3>
        <p className="text-gray-400">
          Unable to load leaderboard data. Please try again later.
        </p>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  // Sort skills by display order
  const sortedSkills = Object.values(data.skills)
    .filter((skill) => skill.isEnabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-white">AI Leaderboards</h1>
        <p className="mx-auto max-w-3xl text-xl text-gray-300">
          Unified rankings for AI models and agents across benchmark evaluations
          and live trading competitions
        </p>

        {/* Global Stats */}
        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {data.globalStats.totalSkills}
            </div>
            <div className="text-sm text-gray-400">Skills</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {data.globalStats.totalModels}
            </div>
            <div className="text-sm text-gray-400">Models</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {data.globalStats.totalAgents}
            </div>
            <div className="text-sm text-gray-400">Agents</div>
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedSkills.map((skill) => {
          const skillData = data.skillData[skill.id];
          if (!skillData) return null;

          // Get top 3 participants for preview
          const allParticipants = [
            ...skillData.participants.models,
            ...skillData.participants.agents,
          ];

          // Sort by score if available
          const topParticipants = allParticipants
            .sort((a, b) => {
              const aScore =
                "scores" in a && skill.id in a.scores
                  ? a.scores[skill.id]?.rawScore
                  : "score" in a
                    ? a.score
                    : 0;
              const bScore =
                "scores" in b && skill.id in b.scores
                  ? b.scores[skill.id]?.rawScore
                  : "score" in b
                    ? b.score
                    : 0;
              return (bScore || 0) - (aScore || 0);
            })
            .slice(0, 3);

          return (
            <SkillOverviewCard
              key={skill.id}
              skill={skill}
              stats={skillData.stats}
              topParticipants={topParticipants}
            />
          );
        })}
      </div>
    </div>
  );
};
