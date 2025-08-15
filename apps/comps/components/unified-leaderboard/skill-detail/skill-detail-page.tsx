"use client";

import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Info,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@recallnet/ui2/components/badge";
import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { useUnifiedLeaderboard } from "@/hooks/useUnifiedLeaderboard";

import { SkillDetailLeaderboardTable } from "./skill-detail-leaderboard-table";

interface SkillDetailPageProps {
  skillId: string;
}

export const SkillDetailPage: React.FC<SkillDetailPageProps> = ({
  skillId,
}) => {
  const { data, isLoading, error } = useUnifiedLeaderboard();

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="text-gray-400">Loading skill data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold text-red-400">
          Error Loading Skill
        </h3>
        <p className="text-gray-400">
          Unable to load skill data. Please try again later.
        </p>
      </Card>
    );
  }

  const skill = data?.skills[skillId];
  const skillData = data?.skillData[skillId];

  if (!skill || !skillData) {
    return (
      <Card className="p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold text-yellow-400">
          Skill Not Found
        </h3>
        <p className="text-gray-400">
          The requested skill could not be found or is not currently available.
        </p>
        <Link href="/leaderboards">
          <Button variant="outline" className="mt-4">
            <ArrowLeft size={16} className="mr-2" />
            Back to Leaderboards
          </Button>
        </Link>
      </Card>
    );
  }

  const isTrading = skill.category === "trading";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/leaderboards">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800 hover:text-white"
          >
            <ArrowLeft size={16} className="mr-2" />
            Leaderboards
          </Button>
        </Link>
        <div className="h-6 w-px bg-gray-700" />
        <Badge
          className={cn(
            "text-sm",
            isTrading
              ? "bg-green-900 text-green-300"
              : "bg-blue-900 text-blue-300",
          )}
        >
          {isTrading ? "LIVE" : "BENCHMARK"}
        </Badge>
      </div>

      {/* Skill Info */}
      <div className="space-y-6">
        <div>
          <h1 className="mb-4 text-4xl font-bold text-white">{skill.name}</h1>
          <p className="text-xl leading-relaxed text-gray-300">
            {skill.description}
          </p>
        </div>

        {/* Extended Description */}
        {skill.longDescription && (
          <Card className="border-gray-800 p-6">
            <div className="flex items-start gap-3">
              <Info size={20} className="mt-1 flex-shrink-0 text-blue-400" />
              <div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  About This Skill
                </h3>
                <p className="leading-relaxed text-gray-300">
                  {skill.longDescription}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card className="p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Users size={20} className="text-gray-400" />
              <span className="text-2xl font-bold text-white">
                {skillData.stats.totalParticipants}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Total {isTrading ? "Agents" : "Models"}
            </div>
          </Card>

          {skillData.stats.topScore && (
            <Card className="p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <TrendingUp size={20} className="text-green-400" />
                <span className="text-2xl font-bold text-green-400">
                  {typeof skillData.stats.topScore === "number"
                    ? skillData.stats.topScore.toFixed(1)
                    : skillData.stats.topScore}
                </span>
              </div>
              <div className="text-sm text-gray-400">Top Score</div>
            </Card>
          )}

          {skillData.stats.avgScore && (
            <Card className="p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <TrendingUp size={20} className="text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">
                  {skillData.stats.avgScore.toFixed(1)}
                </span>
              </div>
              <div className="text-sm text-gray-400">Average Score</div>
            </Card>
          )}

          <Card className="p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Calendar size={20} className="text-purple-400" />
              <span className="text-2xl font-bold text-purple-400">
                {skillData.stats.modelCount + skillData.stats.agentCount}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              {skillData.stats.modelCount}M + {skillData.stats.agentCount}A
            </div>
          </Card>
        </div>

        {/* Leaderboard Table */}
        <div>
          <h2 className="mb-6 text-2xl font-bold text-white">
            {skill.name} Leaderboard
          </h2>
          <SkillDetailLeaderboardTable skill={skill} skillData={skillData} />
        </div>

        {/* Methodology */}
        {skill.methodology && (
          <Card className="border-gray-800 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Evaluation Methodology
            </h3>
            <p className="leading-relaxed text-gray-300">{skill.methodology}</p>
          </Card>
        )}

        {/* Example Prompts */}
        {skill.examplePrompts && skill.examplePrompts.length > 0 && (
          <Card className="border-gray-800 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Example Prompts
            </h3>
            <div className="space-y-3">
              {skill.examplePrompts.map((prompt, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-gray-900 p-4 font-mono text-sm text-gray-300"
                >
                  {prompt}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Research Links */}
        {skill.researchLinks && skill.researchLinks.length > 0 && (
          <Card className="border-gray-800 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Research & References
            </h3>
            <div className="space-y-3">
              {skill.researchLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 transition-colors hover:text-blue-300"
                >
                  <ExternalLink size={16} />
                  {link.title}
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
