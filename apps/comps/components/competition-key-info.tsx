"use client";

import { ArrowUpRight, Info } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { Recall } from "@/components/Recall";
import { CompetitionStateSummary } from "@/components/competition-state-summary";
import { RewardsTGE } from "@/components/rewards-tge";
import type { RouterOutputs } from "@/rpc/router";
import {
  formatCompetitionDates,
  getCompetitionSkills,
  getEvaluationMetricDisplayName,
} from "@/utils/competition-utils";
import { formatAmount, formatCompactNumber } from "@/utils/format";

export const CellTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <span
    className={cn(
      "text-secondary-foreground text-xs font-semibold uppercase tracking-widest",
      className,
    )}
  >
    {children}
  </span>
);

interface CompetitionInfoSectionsProps {
  competition: RouterOutputs["competitions"]["getById"];
  showStateSummary?: boolean;
  showEvaluationMetric?: boolean;
  className?: string;
}

export function CompetitionInfoSections({
  competition,
  showStateSummary = true,
  showEvaluationMetric = false,
  className,
}: CompetitionInfoSectionsProps) {
  const [expanded, setExpanded] = useState(false);
  const SHORT_DESC_LENGTH = 120;
  const isLong =
    competition.description?.length &&
    competition.description.length > SHORT_DESC_LENGTH;
  const shortDesc = useMemo(
    () =>
      isLong
        ? `${competition.description?.slice(0, SHORT_DESC_LENGTH)}...`
        : competition.description,
    [competition.description, isLong],
  );

  const renderNumber = useCallback(
    (value: number, prefix = "") => (
      <>
        <span className="hidden sm:inline">
          {prefix}
          {formatAmount(value, 0, true)}
        </span>
        <span className="sm:hidden">
          {prefix}
          {formatCompactNumber(value)}
        </span>
      </>
    ),
    [],
  );

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      {showStateSummary && competition.status !== "ended" && (
        <div className="border-b bg-[#0C0D12] px-4 py-2">
          <CompetitionStateSummary competition={competition} />
        </div>
      )}

      <div className="grid grid-cols-1 border-b">
        <div className="flex flex-col items-start gap-2 p-4">
          <CellTitle>Skills</CellTitle>
          <div className="flex flex-wrap gap-2">
            {getCompetitionSkills(competition.type).map((skill) => (
              <span
                key={skill}
                className="rounded-sm border border-gray-600 px-2 py-1 text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showEvaluationMetric && competition.evaluationMetric && (
        <div className="grid grid-cols-1 border-b">
          <div className="flex flex-col items-start gap-2 p-4">
            <CellTitle>Ranked by</CellTitle>
            <Tooltip content="The primary metric used to rank agents in this competition">
              <span className="flex items-center gap-2 font-bold">
                {getEvaluationMetricDisplayName(competition.evaluationMetric)}
                <Info className="h-4 w-4 text-gray-400" />
              </span>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-b p-4">
        <CellTitle className="shrink-0 uppercase tracking-wider">
          Rewards
        </CellTitle>
        {competition.rewardsTge ? (
          <RewardsTGE
            rewards={{
              agentPrizePool: BigInt(competition.rewardsTge.agentPool),
              userPrizePool: BigInt(competition.rewardsTge.userPool),
            }}
          />
        ) : competition.rewards && competition.rewards.length > 0 ? (
          <div className="flex min-w-0 flex-1 items-center justify-start gap-4 overflow-hidden">
            {competition.rewards
              .sort((a, b) => a.rank - b.rank)
              .slice(0, 3)
              .map((reward) => (
                <div
                  key={reward.rank}
                  className="flex min-w-0 items-center gap-1 sm:gap-2"
                >
                  <span
                    className={cn(
                      "shrink-0 text-xs sm:text-base",
                      reward.rank === 1
                        ? "text-[#FBD362]"
                        : reward.rank === 2
                          ? "text-[#93A5BA]"
                          : "text-[#C76E29]",
                    )}
                  >
                    {reward.rank === 1
                      ? "1st"
                      : reward.rank === 2
                        ? "2nd"
                        : "3rd"}
                  </span>
                  <span className="min-w-0 font-bold text-gray-100">
                    {renderNumber(reward.reward, "$")}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="font-bold">TBA</p>
        )}
      </div>

      <div className="grid grid-cols-2 border-b">
        <div className="flex flex-col items-start gap-2 border-r p-4">
          <CellTitle>Duration</CellTitle>
          <div className="flex flex-wrap gap-2">
            <span className="font-bold">
              <Tooltip
                content={formatCompetitionDates(
                  competition.startDate,
                  competition.endDate,
                  true,
                )}
              >
                {formatCompetitionDates(
                  competition.startDate,
                  competition.endDate,
                )}
              </Tooltip>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 p-4">
          <CellTitle>Boost Window</CellTitle>
          <div className="flex flex-wrap gap-2">
            <span className="font-bold">
              <Tooltip
                className="cursor-tooltip"
                content={formatCompetitionDates(
                  competition.boostStartDate,
                  competition.boostEndDate,
                  true,
                )}
              >
                {formatCompetitionDates(
                  competition.boostStartDate,
                  competition.boostEndDate,
                )}
              </Tooltip>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b">
        <div className="flex flex-col items-start gap-2 border-r p-4">
          <CellTitle>Minimum Agent Stake</CellTitle>
          <Tooltip content="Amount of staked RECALL required for an agent to compete in this competition">
            <div className="font-bold">
              {competition.minimumStake ? (
                <span className="flex items-center gap-2">
                  {formatAmount(competition.minimumStake, 0, true)} <Recall />
                </span>
              ) : (
                "N/A"
              )}
            </div>
          </Tooltip>
        </div>
        <div className="flex flex-col items-start gap-2 p-4">
          <CellTitle>Registration Limit</CellTitle>
          <div className="font-bold">
            <span className="flex items-center gap-2">
              {competition.maxParticipants
                ? competition.maxParticipants
                : "Unlimited"}{" "}
              participants
            </span>
          </div>
        </div>
      </div>

      <div className="border-b p-4">
        <CellTitle className="mb-3 uppercase tracking-wider">About</CellTitle>
        <div
          className={cn(
            "relative",
            expanded ? "max-h-40 overflow-y-auto" : "max-h-16 overflow-hidden",
          )}
        >
          <div className="whitespace-pre-line pr-2">
            {expanded ? competition.description : shortDesc}
          </div>
          {!expanded && isLong && (
            <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-full bg-gradient-to-t from-black to-transparent" />
          )}
        </div>

        <div className="mt-2 text-sm text-gray-400">
          {competition.externalUrl &&
            (() => {
              try {
                const host = new URL(competition.externalUrl).host;
                if (host === "example.com" || host.endsWith(".example.com")) {
                  return null;
                }
                return (
                  <Link
                    href={competition.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center whitespace-nowrap"
                  >
                    Read more about the official competition rules{" "}
                    <ArrowUpRight size={16} className="ml-1" />
                  </Link>
                );
              } catch {
                return null;
              }
            })()}
        </div>
        {isLong && (
          <button
            className="mt-2 self-start transition-colors"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "SHOW LESS" : "SHOW MORE"}
          </button>
        )}
      </div>
    </div>
  );
}
