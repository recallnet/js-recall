"use client";

import {
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  Trophy,
  Users,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Badge } from "@recallnet/ui2/components/badge";
import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { useUnifiedLeaderboard } from "@/hooks/useUnifiedLeaderboard";
import { client } from "@/rpc/clients/client-side";
import { LeaderboardAgent } from "@/types/agent";
import { checkIsAgentSkill } from "@/utils/competition-utils";

import { SkillDetailLeaderboardTable } from "./skill-detail-leaderboard-table";
import { SkillDetailLeaderboardTableMobile } from "./skill-detail-leaderboard-table-mobile";

interface SkillDetailPageProps {
  skillId: string;
}

export const SkillDetailPage: React.FC<SkillDetailPageProps> = ({
  skillId,
}) => {
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [additionalAgents, setAdditionalAgents] = useState<LeaderboardAgent[]>(
    [],
  );
  const [currentOffset, setCurrentOffset] = useState(100); // Start at 100 since initial load gets first 100
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, error } = useUnifiedLeaderboard();

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const result = await client.leaderboard.getGlobal({
        type: "trading",
        limit: 100,
        offset: currentOffset,
      });
      if (result?.agents) {
        setAdditionalAgents((prev) => [...prev, ...result.agents]);
        setCurrentOffset((prev) => prev + 100);
      }
    } catch (error) {
      console.error("Failed to load more agents:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset]);

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
      <div className="space-y-8 pb-16">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: "Leaderboards", href: "/leaderboards" },
          ]}
        />
        <Card className="p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-400">
            Error Loading Skill
          </h3>
          <p className="text-gray-400">
            Unable to load skill data. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  const skill = data?.skills[skillId];
  let skillData = data?.skillData[skillId];

  if (
    skill &&
    checkIsAgentSkill(skill.category) &&
    skillData &&
    additionalAgents.length > 0
  ) {
    skillData = {
      ...skillData,
      participants: {
        ...skillData.participants,
        agents: [...skillData.participants.agents, ...additionalAgents],
      },
    };
  }

  if (!skill || !skillData) {
    return (
      <div className="space-y-8 pb-16">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: "Leaderboards", href: "/leaderboards" },
          ]}
        />
        <Card className="p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-yellow-400">
            Skill Not Found
          </h3>
          <p className="text-gray-400">
            The requested skill could not be found or is not currently
            available.
          </p>
        </Card>
      </div>
    );
  }

  const isAgentSkill = checkIsAgentSkill(skill.category);
  return (
    <div className="space-y-8 pb-16">
      <BreadcrumbNav
        items={[
          { label: "Home", href: "/" },
          { label: "Leaderboards", href: "/leaderboards" },
          { label: skill.name },
        ]}
      />

      {/* Skill Info */}
      <div className="space-y-6">
        <div>
          <h1 className="mb-4 text-4xl font-bold text-white">{skill.name}</h1>
          <p className="text-xl leading-relaxed text-gray-300">
            {skill.description}
          </p>
        </div>

        {/* Skill Category Info */}
        <Card className="border-gray-800 bg-gray-900/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Evaluation Type:</span>
              <Badge
                className={cn(
                  "text-sm",
                  isAgentSkill
                    ? "bg-green-900 text-green-300"
                    : "bg-blue-900 text-blue-300",
                )}
              >
                {isAgentSkill ? "AGENT" : "MODEL"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Extended Description - Collapsible on Mobile */}
        {skill.longDescription && (
          <Card className="border-gray-800 p-6">
            <button
              onClick={() => setIsAboutExpanded(!isAboutExpanded)}
              className="-m-2 flex w-full items-start gap-3 rounded p-2 text-left transition-colors hover:bg-gray-800/50 md:pointer-events-none md:cursor-default"
            >
              <Info size={20} className="mt-1 flex-shrink-0 text-blue-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    About This Skill
                  </h3>
                  <div className="md:hidden">
                    {isAboutExpanded ? (
                      <ChevronDown size={20} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isAboutExpanded
                  ? "mt-3 max-h-96 opacity-100"
                  : "max-h-0 opacity-0 md:mt-3 md:max-h-none md:opacity-100"
              }`}
            >
              <p className="ml-8 leading-relaxed text-gray-300 md:ml-0">
                {skill.longDescription}
              </p>
            </div>
          </Card>
        )}

        {/* Stats Overview - Compact on Mobile */}
        <div className="md:hidden">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="mb-1 flex items-center justify-center gap-1">
                  <Users size={16} className="text-gray-400" />
                  <span className="text-lg font-bold text-white">
                    {skillData.stats.totalParticipants}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {isAgentSkill ? "Agents" : "Models"}
                </div>
              </div>

              {skillData.stats.topScore && (
                <div>
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <Trophy size={16} className="text-green-400" />
                    <span className="text-lg font-bold text-green-400">
                      {typeof skillData.stats.topScore === "number"
                        ? skillData.stats.topScore.toFixed(0)
                        : skillData.stats.topScore}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">Top Score</div>
                </div>
              )}

              {skillData.stats.avgScore && (
                <div>
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <ChartNoAxesColumn size={16} className="text-blue-400" />
                    <span className="text-lg font-bold text-blue-400">
                      {skillData.stats.avgScore.toFixed(0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">Average</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Stats Overview - Desktop */}
        <div className="hidden grid-cols-3 gap-6 md:grid">
          <Card className="p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Users size={20} className="text-gray-400" />
              <span className="text-2xl font-bold text-white">
                {skillData.stats.totalParticipants}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Total {isAgentSkill ? "Agents" : "Models"}
            </div>
          </Card>

          {skillData.stats.topScore && (
            <Card className="p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Trophy size={20} className="text-green-400" />
                <span className="text-2xl font-bold text-green-400">
                  {typeof skillData.stats.topScore === "number"
                    ? skillData.stats.topScore.toFixed(0)
                    : skillData.stats.topScore}
                </span>
              </div>
              <div className="text-sm text-gray-400">Top Score</div>
            </Card>
          )}

          {skillData.stats.avgScore && (
            <Card className="p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <ChartNoAxesColumn size={20} className="text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">
                  {skillData.stats.avgScore.toFixed(0)}
                </span>
              </div>
              <div className="text-sm text-gray-400">Average Score</div>
            </Card>
          )}
        </div>

        {/* Leaderboard Table */}
        <div>
          {/* Desktop View */}
          <div className="hidden md:block">
            <SkillDetailLeaderboardTable skill={skill} skillData={skillData} />
          </div>

          {/* Mobile View */}
          <div className="block md:hidden">
            <SkillDetailLeaderboardTableMobile
              skill={skill}
              skillData={skillData}
            />
          </div>

          {/* Load More Button for agent skills */}
          {checkIsAgentSkill(skill.category) &&
            skillData.participants.agents.length <
              skillData.stats.agentCount && (
              <div className="mt-6 text-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="min-w-[200px]"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Agents
                      <span className="ml-2 text-gray-400">
                        ({skillData.participants.agents.length} /{" "}
                        {skillData.stats.agentCount})
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
        </div>

        {/* Methodology */}
        {skill.methodology && (
          <Card className="border-gray-800 p-6">
            <h2 className="mb-6 text-2xl font-bold text-white">
              Evaluation Methodology
            </h2>
            <div className="prose prose-invert prose-gray max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-4 text-2xl font-bold text-white">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-3 text-xl font-semibold text-white">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 text-lg font-medium text-white">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="mb-2 text-base font-medium text-gray-200">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 leading-relaxed text-gray-300">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-4 ml-6 list-disc space-y-1 text-gray-300">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 ml-6 list-decimal space-y-1 text-gray-300">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-300">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-white">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-gray-200">{children}</em>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-sm text-blue-300">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-900 p-4">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-4 border-l-4 border-gray-600 pl-4 italic text-gray-400">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {skill.methodology}
              </ReactMarkdown>
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
