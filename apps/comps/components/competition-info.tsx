"use client";

import React, { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { useCompetitionRules } from "@/hooks";
import { Competition } from "@/types/competition";
import { formatCompetitionType } from "@/utils/competition-utils";
import { formatDate } from "@/utils/format";

import { CompetitionStatusBadge } from "./competition-status-badge";
import { Rewards } from "./rewards";

export interface CompetitionInfoProps {
  competition: Competition;
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
  const [rulesExpanded, setRulesExpanded] = useState(false);
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
    <section className={cn(className, "border text-white")}>
      <div className="grid grid-cols-2 border-b">
        <div className="flex flex-col items-start gap-2 border-r p-[25px]">
          <CellTitle>Reward</CellTitle>
          {competition.rewards ? (
            <Rewards rewards={competition.rewards} />
          ) : (
            <p className="text-xl font-semibold">TBA</p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 p-[25px]">
          <div className="flex w-full items-center justify-between">
            <CellTitle>Status</CellTitle>
            <CompetitionStatusBadge status={competition.status} />
          </div>
          <span className="font-bold">
            {startDate} - {endDate}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b">
        <div className="flex items-center gap-2 border-r p-[25px]">
          <CellTitle>Skills</CellTitle>
          <div className="flex flex-wrap gap-2">
            <span className="rounded border p-2 text-xs capitalize">
              {formatCompetitionType(competition.type)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 p-[25px]">
          <CellTitle>Participants</CellTitle>
          {competition.maxParticipants ? (
            <div className="mt-2 grid w-full grid-cols-2 gap-4">
              <div className="flex flex-col">
                <CellTitle className="mb-1 font-medium">Registered</CellTitle>
                <span className="font-bold">
                  {competition.registeredParticipants}
                </span>
              </div>
              <div className="flex flex-col">
                <CellTitle className="mb-1 font-medium">Limit</CellTitle>
                <span className="font-bold">{competition.maxParticipants}</span>
              </div>
            </div>
          ) : (
            <span className="font-bold">
              {competition.registeredParticipants}
            </span>
          )}
        </div>
      </div>

      <div className="border-b">
        <div className="p-[25px]">
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
          {isLong && (
            <button
              className="hover: mt-2 self-start transition-colors"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "SHOW LESS" : "READ MORE"}
            </button>
          )}
        </div>
      </div>

      {/* Rules Section */}
      <div className="border-b">
        <div className="p-[25px]">
          <CellTitle>Rules & Constraints</CellTitle>
          {rulesLoading ? (
            <p className="mt-2 text-sm text-gray-400">Loading rules...</p>
          ) : rules ? (
            <div className="mt-2 space-y-3">
              {/* Starting Balances */}
              <div>
                <span className="text-sm font-medium">Starting Balance</span>
                <p className="text-sm text-gray-400">
                  {rules.tradingRules.find((rule) =>
                    rule.includes("start with"),
                  ) || "See full rules for details"}
                </p>
              </div>

              {/* Trading Constraints */}
              {rules.tradingConstraints && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-sm font-medium">Min Token Age</span>
                    <p className="text-sm text-gray-400">
                      {rules.tradingConstraints.minimumPairAgeHours} hours
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Min 24h Volume</span>
                    <p className="text-sm text-gray-400">
                      $
                      {rules.tradingConstraints.minimum24hVolumeUsd.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Min Liquidity</span>
                    <p className="text-sm text-gray-400">
                      $
                      {rules.tradingConstraints.minimumLiquidityUsd.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Min FDV</span>
                    <p className="text-sm text-gray-400">
                      ${rules.tradingConstraints.minimumFdvUsd.toLocaleString()}
                    </p>
                  </div>
                  {rules.tradingConstraints.minTradesPerDay !== null &&
                    rules.tradingConstraints.minTradesPerDay !== undefined && (
                      <div>
                        <span className="text-sm font-medium">
                          Min Trades/Day
                        </span>
                        <p className="text-sm text-gray-400">
                          {rules.tradingConstraints.minTradesPerDay} trades
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Show More/Less for detailed rules */}
              {rulesExpanded && (
                <div className="mt-3 space-y-3">
                  <div>
                    <span className="text-sm font-medium">Trading Rules</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-gray-400">
                      {rules.tradingRules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-sm font-medium">
                      Available Chains
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
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
                  </div>

                  <div>
                    <span className="text-sm font-medium">Rate Limits</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-gray-400">
                      {rules.rateLimits.slice(0, 3).map((limit, idx) => (
                        <li key={idx}>{limit}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Rules not available</p>
          )}

          {/* Expand/Collapse button */}
          {rules && (
            <button
              className="mt-3 text-sm transition-colors hover:underline"
              onClick={() => setRulesExpanded(!rulesExpanded)}
              aria-expanded={rulesExpanded}
            >
              {rulesExpanded ? "SHOW LESS" : "VIEW ALL RULES"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="flex flex-col items-start justify-center gap-2 border-r p-[25px]">
          <CellTitle>Total Trades</CellTitle>
          <span className="font-bold">{competition.stats.totalTrades}</span>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 border-r p-[25px]">
          <CellTitle>Volume</CellTitle>
          <span className="font-bold">
            $
            {competition.stats.totalVolume.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 p-[25px]">
          <CellTitle>Tokens Traded</CellTitle>
          <span className="font-bold">{competition.stats.uniqueTokens}</span>
        </div>
      </div>
    </section>
  );
};
