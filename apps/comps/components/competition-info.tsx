"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { useCompetitionRules } from "@/hooks";
import { RouterOutputs } from "@/rpc/router";
import { CompetitionStatus } from "@/types";
import { getCompetitionSkills } from "@/utils/competition-utils";
import { formatAmount, formatCompactNumber, formatDate } from "@/utils/format";

import { CompetitionStateSummary } from "./competition-state-summary";
import { RewardsTGE } from "./rewards-tge";

export interface CompetitionInfoProps {
  competition: RouterOutputs["competitions"]["getById"];
  className?: string;
}

const CellTitle: React.FC<{
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

export const CompetitionInfo: React.FC<CompetitionInfoProps> = ({
  competition,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [tradingRulesExpanded, setTradingRulesExpanded] = useState(false);
  const [chainsExpanded, setChainsExpanded] = useState(false);
  const [rateLimitsExpanded, setRateLimitsExpanded] = useState(false);
  const { data: rules, isLoading: rulesLoading } = useCompetitionRules(
    competition.id,
  );

  // Helper to render responsive numbers (full on desktop, compact on mobile)
  const renderNumber = (value: number, prefix = "") => (
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
  );

  const startDate = competition.startDate
    ? formatDate(new Date(competition.startDate))
    : "TBA";
  const endDate = competition.endDate
    ? formatDate(new Date(competition.endDate))
    : "TBA";

  const SHORT_DESC_LENGTH = 120;
  const isLong =
    competition.description?.length &&
    competition.description.length > SHORT_DESC_LENGTH;
  const shortDesc = isLong
    ? competition.description?.slice(0, SHORT_DESC_LENGTH) + "..."
    : competition.description;

  return (
    <Tabs defaultValue="info" className={cn(className, "text-white")}>
      <TabsList className="mb-4 gap-2">
        <TabsTrigger
          value="info"
          className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:hover:bg-white data-[state=active]:hover:text-black"
        >
          Info
        </TabsTrigger>
        {/* TODO: temporarily disable rules for perpetual futures since the `/rules` endpoint is inaccurate */}
        {competition.type !== "perpetual_futures" && (
          <TabsTrigger
            value="rules"
            className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:hover:bg-white data-[state=active]:hover:text-black"
          >
            Rules
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="info" className="border">
        <div>
          {/* Registration and Voting Status Bar - At the very top */}
          {competition.status !== CompetitionStatus.Ended && (
            <div className="border-b bg-[#0C0D12] px-4 py-2">
              <CompetitionStateSummary competition={competition} />
            </div>
          )}

          {/* Skills and Dates Row */}
          <div className="grid grid-cols-2 border-b">
            <div className="flex flex-col items-start gap-2 border-r p-4 sm:p-[25px]">
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
            <div className="flex flex-col items-start gap-2 p-4 sm:p-[25px]">
              <CellTitle>Dates</CellTitle>
              <p className="font-bold">
                {startDate} - {endDate}
              </p>
            </div>
          </div>

          {/* Rewards Row */}
          <div className="flex items-center gap-2 border-b px-3 py-4 sm:gap-6 sm:px-6 sm:py-6">
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
              <div className="flex min-w-0 flex-1 items-center justify-start gap-4 overflow-hidden sm:gap-8">
                {competition.rewards
                  .sort((a, b) => a.rank - b.rank)
                  .slice(0, 3)
                  .map((r) => (
                    <div
                      key={r.rank}
                      className="flex min-w-0 items-center gap-1 sm:gap-2"
                    >
                      <span
                        className={cn(
                          "shrink-0 text-xs sm:text-base",
                          r.rank === 1
                            ? "text-[#FBD362]"
                            : r.rank === 2
                              ? "text-[#93A5BA]"
                              : "text-[#C76E29]",
                        )}
                      >
                        {r.rank === 1 ? "1st" : r.rank === 2 ? "2nd" : "3rd"}
                      </span>
                      <span className="min-w-0 font-bold text-gray-100">
                        {renderNumber(r.reward, "$")}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xl font-semibold">TBA</p>
            )}
          </div>

          {/* About Section */}
          <div className="border-b p-4 sm:p-[25px]">
            <CellTitle className="mb-3 uppercase tracking-wider">
              About
            </CellTitle>
            <div
              className={`relative ${expanded ? "max-h-40 overflow-y-auto" : "max-h-16 overflow-hidden"}`}
            >
              <p className="whitespace-pre-line pr-2">
                {expanded ? competition.description : shortDesc}
              </p>
              {!expanded && isLong && (
                <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-full bg-gradient-to-t from-black to-transparent" />
              )}
            </div>

            {/* Registration Limit */}
            {competition.maxParticipants &&
              competition.registeredParticipants <
                competition.maxParticipants && (
                <p className="mt-3 text-sm text-gray-400">
                  Registration limit: {competition.maxParticipants} participants
                </p>
              )}

            {/* Minimum Stake */}
            {competition.minimumStake && (
              <p className="mt-3 text-sm text-gray-400">
                Minimum Stake:{" "}
                {competition.minimumStake.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}

            <p className="mt-2 text-sm text-gray-400">
              {competition.externalUrl &&
                (() => {
                  // Note: `example.com` was used in legacy competitions and should be ignored
                  try {
                    const host = new URL(competition.externalUrl).host;
                    // Skip if host is exactly 'example.com' or a subdomain of example.com
                    if (
                      host === "example.com" ||
                      host.endsWith(".example.com")
                    ) {
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
                    // Invalid URL, don't render the link
                    return null;
                  }
                })()}
            </p>
            {isLong && (
              <button
                className="hover: mt-2 self-start transition-colors"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded ? "SHOW LESS" : "SHOW MORE"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3">
            <div className="flex min-w-0 flex-col items-start justify-center gap-2 border-r p-3 sm:p-[25px]">
              <CellTitle>
                {competition.type === "perpetual_futures"
                  ? "Total Positions"
                  : "Total Trades"}
              </CellTitle>
              <span className="font-bold">
                {renderNumber(
                  competition.type === "perpetual_futures"
                    ? (competition.stats.totalPositions ?? 0)
                    : (competition.stats.totalTrades ?? 0),
                )}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-start justify-center gap-2 border-r p-3 sm:p-[25px]">
              <CellTitle>Volume</CellTitle>
              <span className="font-bold">
                {renderNumber(competition.stats.totalVolume ?? 0, "$")}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-start justify-center gap-2 p-3 sm:p-[25px]">
              <CellTitle>
                {competition.type === "perpetual_futures"
                  ? "Average Equity"
                  : "Tokens Traded"}
              </CellTitle>
              <span className="font-bold">
                {competition.type === "perpetual_futures"
                  ? renderNumber(competition.stats.averageEquity ?? 0, "$")
                  : renderNumber(competition.stats.uniqueTokens ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rules" className="border">
        <div>
          {rulesLoading ? (
            <div className="p-4 sm:p-[25px]">
              <p className="text-sm text-gray-400">Loading rules...</p>
            </div>
          ) : rules ? (
            <div className="divide-y">
              {/* Balances & Constraints Section */}
              <div
                className="cursor-pointer p-4 sm:p-[25px]"
                onClick={() => setBalancesExpanded(!balancesExpanded)}
                aria-expanded={balancesExpanded}
                role="button"
              >
                <div className="flex w-full items-center justify-between">
                  <CellTitle>Balances & Constraints</CellTitle>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      balancesExpanded ? "rotate-180" : "",
                    )}
                  />
                </div>
                {balancesExpanded && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <span className="text-sm font-medium">
                        Starting Balance
                      </span>
                      <p className="text-sm text-gray-400">
                        {rules.tradingRules.find((rule) =>
                          rule.includes("start with"),
                        ) || "See full rules for details"}
                      </p>
                    </div>
                    {rules.tradingConstraints && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <span className="text-sm font-medium">
                            Min Token Age
                          </span>
                          <p className="text-sm text-gray-400">
                            {rules.tradingConstraints.minimumPairAgeHours} hours
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            Min 24h Volume
                          </span>
                          <p className="text-sm text-gray-400">
                            $
                            {rules.tradingConstraints.minimum24hVolumeUsd.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            Min Liquidity
                          </span>
                          <p className="text-sm text-gray-400">
                            $
                            {rules.tradingConstraints.minimumLiquidityUsd.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Min FDV</span>
                          <p className="text-sm text-gray-400">
                            $
                            {rules.tradingConstraints.minimumFdvUsd.toLocaleString()}
                          </p>
                        </div>
                        {rules.tradingConstraints.minTradesPerDay !== null &&
                          rules.tradingConstraints.minTradesPerDay !==
                            undefined && (
                            <div>
                              <span className="text-sm font-medium">
                                Min Trades/Day
                              </span>
                              <p className="text-sm text-gray-400">
                                {rules.tradingConstraints.minTradesPerDay}{" "}
                                trades
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trading Rules Section */}
              <div
                className="cursor-pointer p-4 sm:p-[25px]"
                onClick={() => setTradingRulesExpanded(!tradingRulesExpanded)}
                aria-expanded={tradingRulesExpanded}
                role="button"
              >
                <div className="flex w-full items-center justify-between">
                  <CellTitle>Trading Rules</CellTitle>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      tradingRulesExpanded ? "rotate-180" : "",
                    )}
                  />
                </div>
                {tradingRulesExpanded && (
                  <div className="mt-4">
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
                      {rules.tradingRules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Supported Chains Section */}
              <div
                className="cursor-pointer p-4 sm:p-[25px]"
                onClick={() => setChainsExpanded(!chainsExpanded)}
                aria-expanded={chainsExpanded}
                role="button"
              >
                <div className="flex w-full items-center justify-between">
                  <CellTitle>Supported Chains</CellTitle>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      chainsExpanded ? "rotate-180" : "",
                    )}
                  />
                </div>
                {chainsExpanded && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {rules.availableChains.svm && (
                      <span className="rounded border px-2 py-1 text-xs">
                        Solana
                      </span>
                    )}
                    {rules.availableChains.evm.map((chain) => (
                      <span
                        key={chain}
                        className="rounded border px-2 py-1 text-xs capitalize"
                      >
                        {chain}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rate Limits Section */}
              <div
                className="cursor-pointer p-4 sm:p-[25px]"
                onClick={() => setRateLimitsExpanded(!rateLimitsExpanded)}
                aria-expanded={rateLimitsExpanded}
                role="button"
              >
                <div className="flex w-full items-center justify-between">
                  <CellTitle>Rate Limits</CellTitle>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      rateLimitsExpanded ? "rotate-180" : "",
                    )}
                  />
                </div>
                {rateLimitsExpanded && (
                  <div className="mt-4">
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
                      {rules.rateLimits.map((limit, idx) => (
                        <li key={idx}>{limit}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-[25px]">
              <p className="text-sm text-gray-400">Rules not available</p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
};
