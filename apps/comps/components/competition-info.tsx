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
import { formatDate } from "@/utils/format";

import { CompetitionStateSummary } from "./competition-state-summary";
import { CompetitionStatusBadge } from "./competition-status-badge";
import { Rewards } from "./rewards";

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
          <div className="grid grid-cols-2 border-b">
            <div className="flex flex-col items-start gap-2 border-r p-4 sm:p-[25px]">
              <CellTitle>Reward</CellTitle>
              {competition.rewards ? (
                <Rewards rewards={competition.rewards} />
              ) : (
                <p className="text-xl font-semibold">TBA</p>
              )}
            </div>
            <div className="flex flex-col items-start gap-2 p-4 sm:p-[25px]">
              <div className="flex w-full items-center justify-between">
                <CellTitle>Status</CellTitle>
                <CompetitionStatusBadge status={competition.status} />
              </div>
              <span>
                {startDate} - {endDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b p-4 sm:p-[25px]">
            <CellTitle>Skills</CellTitle>
            <div className="flex flex-wrap gap-2">
              {getCompetitionSkills(competition.type).map((skill) => (
                <span
                  key={skill}
                  className="rounded border p-2 text-xs capitalize"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Integrated voting/registration status */}
          {competition.status !== CompetitionStatus.Ended && (
            <div className="border-b p-4 sm:p-[25px]">
              <CellTitle className="mb-3">Registration & Voting</CellTitle>
              <CompetitionStateSummary competition={competition} />
            </div>
          )}

          <div className="border-b">
            <div className="p-4 sm:p-[25px]">
              <CellTitle>About</CellTitle>
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
              <p className="mt-2 text-sm text-gray-400">
                {competition.externalUrl &&
                  // Note: `example.com` was used in legacy competitions and should be ignored
                  !competition.externalUrl.includes("example.com") && (
                    <Link
                      href={competition.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center whitespace-nowrap"
                    >
                      Read more about the official competition rules{" "}
                      <ArrowUpRight size={16} className="ml-1" />
                    </Link>
                  )}
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
          </div>

          <div className="grid grid-cols-3">
            <div className="flex flex-col items-start justify-center gap-2 border-r p-4 sm:p-[25px]">
              <CellTitle>
                {competition.type === "perpetual_futures"
                  ? "Total Positions"
                  : "Total Trades"}
              </CellTitle>
              <span className="font-bold">
                {competition.type === "perpetual_futures"
                  ? (competition.stats.totalPositions ?? 0)
                  : (competition.stats.totalTrades ?? 0)}
              </span>
            </div>
            <div className="flex flex-col items-start justify-center gap-2 border-r p-4 sm:p-[25px]">
              <CellTitle>Volume</CellTitle>
              <span className="font-bold">
                $
                {(competition.stats.totalVolume ?? 0).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}
              </span>
            </div>
            <div className="flex flex-col items-start justify-center gap-2 p-4 sm:p-[25px]">
              <CellTitle>
                {competition.type === "perpetual_futures"
                  ? "Average Equity"
                  : "Tokens Traded"}
              </CellTitle>
              <span className="font-bold">
                {competition.type === "perpetual_futures"
                  ? `$${(competition.stats.averageEquity ?? 0).toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}`
                  : (competition.stats.uniqueTokens ?? 0)}
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
