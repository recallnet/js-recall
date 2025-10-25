"use client";

import { ArrowUpRight, ChevronDown, Info, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { Recall } from "@/components/Recall";
import { CompetitionStateSummary } from "@/components/competition-state-summary";
import { Pagination } from "@/components/pagination";
import { useCompetitionRules } from "@/hooks";
import { useCompetitionPerpsPositions } from "@/hooks/useCompetitionPerpsPositions";
import { useCompetitionTrades } from "@/hooks/useCompetitionTrades";
import { RouterOutputs } from "@/rpc/router";
import {
  checkIsPerpsCompetition,
  getCompetitionSkills,
} from "@/utils/competition-utils";
import { formatAmount, formatCompactNumber, formatDate } from "@/utils/format";

export interface CompetitionKeyProps {
  competition: RouterOutputs["competitions"]["getById"];
  className?: string;
}

const LIMIT_TRADES_PER_PAGE = 10;
const LIMIT_POSITIONS_PER_PAGE = 10;

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

/**
 * CompetitionKey component displays tabs with trades, positions, predictions, info, and rules.
 * On mobile, it's accessible via a "View Details" button that opens a dialog.
 */
export const CompetitionKey: React.FC<CompetitionKeyProps> = ({
  competition,
  className,
}) => {
  const isPerpsCompetition = checkIsPerpsCompetition(competition);
  const [expanded, setExpanded] = useState(false);
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [tradingRulesExpanded, setTradingRulesExpanded] = useState(false);
  const [chainsExpanded, setChainsExpanded] = useState(false);
  const [rateLimitsExpanded, setRateLimitsExpanded] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    isPerpsCompetition ? "positions" : "trades",
  );

  const [tradesOffset, setTradesOffset] = useState(0);
  const [positionsOffset, setPositionsOffset] = useState(0);

  const { data: rules, isLoading: rulesLoading } = useCompetitionRules(
    competition.id,
  );

  const { data: tradesData, isLoading: isLoadingTrades } = useCompetitionTrades(
    competition.id,
    {
      offset: tradesOffset,
      limit: LIMIT_TRADES_PER_PAGE,
    },
    !isPerpsCompetition,
  );

  const { data: positionsData, isLoading: isLoadingPositions } =
    useCompetitionPerpsPositions(
      competition.id,
      {
        offset: positionsOffset,
        limit: LIMIT_POSITIONS_PER_PAGE,
      },
      isPerpsCompetition,
    );

  const handleTradesPageChange = useCallback((page: number) => {
    setTradesOffset(LIMIT_TRADES_PER_PAGE * (page - 1));
  }, []);

  const handlePositionsPageChange = useCallback((page: number) => {
    setPositionsOffset(LIMIT_POSITIONS_PER_PAGE * (page - 1));
  }, []);

  // Handle escape key and body scroll lock for mobile sidebar
  useEffect(() => {
    if (!mobileDialogOpen) return;

    // Lock body scroll
    document.body.style.overflow = "hidden";

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileDialogOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileDialogOpen]);

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

  const keyContent = useMemo(
    () => (
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={cn("flex h-full flex-col text-white", className)}
      >
        <TabsList className="mb-6.5 flex flex-shrink-0 flex-wrap gap-2">
          {!isPerpsCompetition && (
            <TabsTrigger
              value="trades"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Trades
            </TabsTrigger>
          )}
          {isPerpsCompetition && (
            <TabsTrigger
              value="positions"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Positions
            </TabsTrigger>
          )}
          <TabsTrigger
            value="predictions"
            className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Predictions
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Info
          </TabsTrigger>
          {!isPerpsCompetition && (
            <TabsTrigger
              value="rules"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Rules
            </TabsTrigger>
          )}
        </TabsList>

        {/* Trades Tab */}
        {!isPerpsCompetition && (
          <TabsContent
            value="trades"
            className="m-0 flex-1 overflow-hidden border"
          >
            <div className="h-full overflow-y-auto p-4">
              {isLoadingTrades ? (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-gray-400">Loading trades...</p>
                </div>
              ) : tradesData && tradesData.trades.length > 0 ? (
                <div>
                  <div className="space-y-3">
                    {tradesData.trades.map((trade, idx) => (
                      <div
                        key={idx}
                        className="border-b border-gray-800 pb-3 last:border-0"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {trade.agent.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatAmount(trade.fromAmount)}{" "}
                          {trade.fromTokenSymbol} →{" "}
                          {formatAmount(trade.toAmount)} {trade.toTokenSymbol}
                        </div>
                        {trade.timestamp && (
                          <div className="mt-1 text-xs text-gray-500">
                            {formatDate(new Date(trade.timestamp))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Pagination
                      totalItems={tradesData.pagination.total}
                      currentPage={
                        Math.floor(tradesOffset / LIMIT_TRADES_PER_PAGE) + 1
                      }
                      itemsPerPage={LIMIT_TRADES_PER_PAGE}
                      onPageChange={handleTradesPageChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-400">No trades yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Positions Tab */}
        {isPerpsCompetition && (
          <TabsContent
            value="positions"
            className="m-0 flex-1 overflow-hidden border"
          >
            <div className="h-full overflow-y-auto p-4">
              {isLoadingPositions ? (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-gray-400">Loading positions...</p>
                </div>
              ) : positionsData && positionsData.positions.length > 0 ? (
                <div>
                  <div className="space-y-3">
                    {positionsData.positions.map((position, idx) => (
                      <div
                        key={idx}
                        className="border-b border-gray-800 pb-3 last:border-0"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {position.agent?.name || "Unknown Agent"}
                          </span>
                          <span
                            className={`text-xs ${position.isLong ? "text-green-500" : "text-red-500"}`}
                          >
                            {position.isLong ? "LONG" : "SHORT"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatAmount(Number(position.positionSize))}{" "}
                          {position.asset} @{" "}
                          {formatAmount(Number(position.entryPrice))}
                        </div>
                        {position.pnlUsdValue && (
                          <div
                            className={`mt-1 text-xs ${Number(position.pnlUsdValue) >= 0 ? "text-green-500" : "text-red-500"}`}
                          >
                            PnL: {formatAmount(Number(position.pnlUsdValue))}{" "}
                            USD
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Pagination
                      totalItems={positionsData.pagination.total}
                      currentPage={
                        Math.floor(positionsOffset / LIMIT_POSITIONS_PER_PAGE) +
                        1
                      }
                      itemsPerPage={LIMIT_POSITIONS_PER_PAGE}
                      onPageChange={handlePositionsPageChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-400">No positions yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Predictions Tab (Placeholder) */}
        <TabsContent
          value="predictions"
          className="m-0 flex-1 overflow-hidden border"
        >
          <div className="flex h-full flex-col items-center justify-center p-8">
            <p className="text-sm text-gray-400">
              Boost predictions coming soon...
            </p>
          </div>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="m-0 flex-1 overflow-hidden border">
          <div className="h-full overflow-y-auto">
            {competition.status !== "ended" && (
              <div className="border-b bg-[#0C0D12] px-4 py-2">
                <CompetitionStateSummary competition={competition} />
              </div>
            )}

            <div className="grid grid-cols-2 border-b">
              <div className="flex flex-col items-start gap-2 border-r p-4">
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
              <div className="flex flex-col items-start gap-2 p-4">
                <CellTitle>Dates</CellTitle>
                <div className="font-bold">
                  {startDate} - {endDate}
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
                        {formatAmount(competition.minimumStake, 0, true)}{" "}
                        <Recall />
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
              <CellTitle className="mb-3 uppercase tracking-wider">
                About
              </CellTitle>
              <div
                className={`relative ${expanded ? "max-h-40 overflow-y-auto" : "max-h-16 overflow-hidden"}`}
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
                      return null;
                    }
                  })()}
              </div>
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
              <div className="flex min-w-0 flex-col items-start justify-center gap-2 border-r p-3">
                <CellTitle>
                  {isPerpsCompetition ? "Total Positions" : "Total Trades"}
                </CellTitle>
                <span className="font-bold">
                  {renderNumber(
                    isPerpsCompetition
                      ? (competition.stats.totalPositions ?? 0)
                      : (competition.stats.totalTrades ?? 0),
                  )}
                </span>
              </div>
              <div className="flex min-w-0 flex-col items-start justify-center gap-2 border-r p-3">
                <CellTitle>Volume</CellTitle>
                <span className="font-bold">
                  {renderNumber(competition.stats.totalVolume ?? 0, "$")}
                </span>
              </div>
              <div className="flex min-w-0 flex-col items-start justify-center gap-2 p-3">
                <CellTitle>
                  {isPerpsCompetition ? "Average Equity" : "Tokens Traded"}
                </CellTitle>
                <span className="font-bold">
                  {isPerpsCompetition
                    ? renderNumber(competition.stats.averageEquity ?? 0, "$")
                    : renderNumber(competition.stats.uniqueTokens ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Rules Tab */}
        {!isPerpsCompetition && (
          <TabsContent
            value="rules"
            className="m-0 flex-1 overflow-hidden border"
          >
            <div className="h-full overflow-y-auto">
              {rulesLoading ? (
                <div className="p-4">
                  <p className="text-sm text-gray-400">Loading rules...</p>
                </div>
              ) : rules ? (
                <div className="divide-y">
                  <div
                    className="cursor-pointer p-4"
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
                          <div className="text-sm text-gray-400">
                            {rules.tradingRules.find((rule) =>
                              rule.includes("start with"),
                            ) || "See full rules for details"}
                          </div>
                        </div>
                        {rules.tradingConstraints && (
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <span className="text-sm font-medium">
                                Min Token Age
                              </span>
                              <div className="text-sm text-gray-400">
                                {rules.tradingConstraints.minimumPairAgeHours}{" "}
                                hours
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium">
                                Min 24h Volume
                              </span>
                              <div className="text-sm text-gray-400">
                                $
                                {rules.tradingConstraints.minimum24hVolumeUsd.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium">
                                Min Liquidity
                              </span>
                              <div className="text-sm text-gray-400">
                                $
                                {rules.tradingConstraints.minimumLiquidityUsd.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium">
                                Min FDV
                              </span>
                              <div className="text-sm text-gray-400">
                                $
                                {rules.tradingConstraints.minimumFdvUsd.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="cursor-pointer p-4"
                    onClick={() =>
                      setTradingRulesExpanded(!tradingRulesExpanded)
                    }
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

                  <div
                    className="cursor-pointer p-4"
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

                  <div
                    className="cursor-pointer p-4"
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
                <div className="p-4">
                  <p className="text-sm text-gray-400">Rules not available</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    ),
    [
      activeTab,
      className,
      isPerpsCompetition,
      tradesData,
      isLoadingTrades,
      positionsData,
      isLoadingPositions,
      tradesOffset,
      positionsOffset,
      handleTradesPageChange,
      handlePositionsPageChange,

      rules,
      rulesLoading,
      expanded,
      balancesExpanded,
      tradingRulesExpanded,
      chainsExpanded,
      rateLimitsExpanded,
      competition,
      startDate,
      endDate,
      shortDesc,
      isLong,
      renderNumber,
    ],
  );

  return (
    <>
      {/* Desktop view */}
      <div className="h-140 hidden md:block">{keyContent}</div>

      {/* Mobile view - button and slide-in sidebar */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileDialogOpen(true)}
          className="fixed bottom-8 right-4 z-40 flex items-center gap-2 border-white bg-black px-4 py-3 font-semibold uppercase text-white shadow-lg hover:bg-white hover:text-black"
        >
          <Info size={20} />
          <span>View Details</span>
        </Button>

        {/* Backdrop overlay */}
        {mobileDialogOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300"
            onClick={() => setMobileDialogOpen(false)}
          />
        )}

        {/* Slide-in sidebar */}
        <div
          className={cn(
            "fixed right-0 top-0 z-[60] h-full w-[85vw] max-w-md transform border-l border-gray-800 bg-black shadow-xl transition-transform duration-300 ease-in-out",
            mobileDialogOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar header */}
            <div className="flex items-center justify-between border-b border-gray-800 p-4">
              <h2 className="text-lg font-bold text-white">
                Competition Details
              </h2>
              <button
                onClick={() => setMobileDialogOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto">{keyContent}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompetitionKey;
