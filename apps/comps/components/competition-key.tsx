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
import { useCompetitionBoosts, useCompetitionRules } from "@/hooks";
import { useCompetitionPerpsPositions } from "@/hooks/useCompetitionPerpsPositions";
import { useCompetitionTrades } from "@/hooks/useCompetitionTrades";
import { RouterOutputs } from "@/rpc/router";
import { displayAddress } from "@/utils/address";
import {
  checkIsPerpsCompetition,
  formatCompetitionDates,
  getCompetitionSkills,
  getEvaluationMetricDisplayName,
} from "@/utils/competition-utils";
import {
  formatAmount,
  formatBigintAmount,
  formatCompactNumber,
  formatDateShort,
  formatRelativeTime,
} from "@/utils/format";

import { BoostIcon } from "./BoostIcon";
import { AgentAvatar } from "./agent-avatar";
import { RewardsTGE } from "./rewards-tge";
import { SkeletonList } from "./skeleton-loaders";

export interface CompetitionKeyProps {
  competition: RouterOutputs["competitions"]["getById"];
  className?: string;
}

const LIMIT_TRADES_PER_PAGE = 50;
const LIMIT_POSITIONS_PER_PAGE = 50;

// In the competition trade logs, we display a relative timestamp for the first 24 hours, then, we
// display the month, day, and time.
const HOURS_IN_MS = 60 * 60 * 1000;
const TRADE_LOG_RELATIVE_TIMESTAMP = 24 * HOURS_IN_MS;
const shouldShowRelativeTimestamp = (timestamp: Date) => {
  return timestamp > new Date(Date.now() - TRADE_LOG_RELATIVE_TIMESTAMP);
};

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
  const isPerpsCompetition = checkIsPerpsCompetition(competition.type);
  const [expanded, setExpanded] = useState(false);
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [tradingRulesExpanded, setTradingRulesExpanded] = useState(false);
  const [chainsExpanded, setChainsExpanded] = useState(false);
  const [rateLimitsExpanded, setRateLimitsExpanded] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  // Note: for pending comps, we show the "info" tab instead of the trades/positions tabs
  const isPendingCompetition = competition.status === "pending";

  // Determine initial tab based on competition status and type
  const getInitialTab = () => {
    if (isPendingCompetition) {
      return "info";
    }
    if (isPerpsCompetition) {
      return "open-positions";
    }
    return "trades";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [tradesOffset, setTradesOffset] = useState(0);
  const [openPositionsOffset, setOpenPositionsOffset] = useState(0);
  const [closedPositionsOffset, setClosedPositionsOffset] = useState(0);

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
    competition.status,
  );

  const { data: openPositionsData, isLoading: isLoadingOpenPositions } =
    useCompetitionPerpsPositions(
      competition.id,
      {
        offset: openPositionsOffset,
        limit: LIMIT_POSITIONS_PER_PAGE,
        status: "Open",
      },
      isPerpsCompetition,
      competition.status,
    );

  const { data: closedPositionsData, isLoading: isLoadingClosedPositions } =
    useCompetitionPerpsPositions(
      competition.id,
      {
        offset: closedPositionsOffset,
        limit: LIMIT_POSITIONS_PER_PAGE,
        status: "Closed",
      },
      isPerpsCompetition,
      competition.status,
    );

  const handleTradesPageChange = useCallback((page: number) => {
    setTradesOffset(LIMIT_TRADES_PER_PAGE * (page - 1));
  }, []);

  const handleOpenPositionsPageChange = useCallback((page: number) => {
    setOpenPositionsOffset(LIMIT_POSITIONS_PER_PAGE * (page - 1));
  }, []);

  const handleClosedPositionsPageChange = useCallback((page: number) => {
    setClosedPositionsOffset(LIMIT_POSITIONS_PER_PAGE * (page - 1));
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
        <TabsList className="mb-6.5 flex flex-shrink-0 flex-wrap gap-2 px-4 md:px-0">
          {!isPerpsCompetition && (
            <TabsTrigger
              value="trades"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Trades
            </TabsTrigger>
          )}
          {isPerpsCompetition && (
            <>
              <TabsTrigger
                value="open-positions"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Open
              </TabsTrigger>
              <TabsTrigger
                value="closed-positions"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Closed
              </TabsTrigger>
            </>
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
                <SkeletonList count={10} type="trade" />
              ) : tradesData && tradesData.trades.length > 0 ? (
                <div>
                  <div className="space-y-3">
                    {tradesData.trades.map((trade, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3 last:border-0"
                      >
                        {/* Left column: Agent info */}
                        <div className="flex items-center gap-2">
                          <AgentAvatar agent={trade.agent} showHover={false} />
                          <span className="text-sm font-semibold">
                            {trade.agent.name}
                          </span>
                        </div>

                        {/* Right column: Trade details */}
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-xs text-gray-400">
                            {formatAmount(trade.fromAmount)}{" "}
                            {trade.fromTokenSymbol} →{" "}
                            {formatAmount(trade.toAmount)} {trade.toTokenSymbol}
                          </span>
                          {trade.timestamp && (
                            <span className="text-xs text-gray-500">
                              {formatDateShort(new Date(trade.timestamp), true)}
                            </span>
                          )}
                        </div>
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
                <div className="flex h-full flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-400">No trades yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Open Positions Tab */}
        {isPerpsCompetition && (
          <TabsContent
            value="open-positions"
            className="m-0 flex-1 overflow-hidden border"
          >
            <div className="h-full overflow-y-auto p-4">
              {isLoadingOpenPositions ? (
                <SkeletonList count={10} type="position" />
              ) : openPositionsData &&
                openPositionsData.positions.length > 0 ? (
                <div>
                  <div className="space-y-3">
                    {openPositionsData.positions.map((position, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3 last:border-0"
                      >
                        {/* Left column: Agent info */}
                        <div className="flex items-center gap-2">
                          <AgentAvatar
                            agent={position.agent}
                            showHover={false}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {position.agent.name}
                            </span>
                          </div>
                        </div>

                        {/* Right column: Position details */}
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span
                            className={`text-xs font-semibold ${position.isLong ? "text-green-400" : "text-red-400"}`}
                          >
                            {position.isLong ? "LONG" : "SHORT"}{" "}
                            {formatAmount(Number(position.positionSize))}{" "}
                            {position.asset}
                          </span>
                          <span className="text-secondary-foreground text-xs">
                            {formatAmount(Number(position.leverage))}x leverage
                            • {formatAmount(Number(position.collateralAmount))}{" "}
                            collateral
                          </span>
                          {position.pnlUsdValue && (
                            <span className="text-secondary-foreground text-xs">
                              PnL:{" "}
                              <span
                                className={`text-xs ${Number(position.pnlUsdValue) >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {formatAmount(Number(position.pnlUsdValue))} USD
                              </span>
                            </span>
                          )}
                          {position.createdAt && (
                            <span className="text-secondary-foreground text-xs font-light">
                              Opened{" "}
                              {shouldShowRelativeTimestamp(position.createdAt)
                                ? formatRelativeTime(position.createdAt)
                                : formatDateShort(position.createdAt, true)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Pagination
                      totalItems={openPositionsData.pagination.total}
                      currentPage={
                        Math.floor(
                          openPositionsOffset / LIMIT_POSITIONS_PER_PAGE,
                        ) + 1
                      }
                      itemsPerPage={LIMIT_POSITIONS_PER_PAGE}
                      onPageChange={handleOpenPositionsPageChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-400">No open positions</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Closed Positions Tab */}
        {isPerpsCompetition && (
          <TabsContent
            value="closed-positions"
            className="m-0 flex-1 overflow-hidden border"
          >
            <div className="h-full overflow-y-auto p-4">
              {isLoadingClosedPositions ? (
                <SkeletonList count={10} type="position" />
              ) : closedPositionsData &&
                closedPositionsData.positions.length > 0 ? (
                <div>
                  <div className="space-y-3">
                    {closedPositionsData.positions.map((position, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3 last:border-0"
                      >
                        {/* Left column: Agent info */}
                        <div className="flex items-center gap-2">
                          <AgentAvatar
                            agent={position.agent}
                            showHover={false}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {position.agent.name}
                            </span>
                          </div>
                        </div>

                        {/* Right column: Position details */}
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span
                            className={`text-xs font-semibold ${position.isLong ? "text-green-400" : "text-red-400"}`}
                          >
                            {position.isLong ? "LONG" : "SHORT"}{" "}
                            {formatAmount(Number(position.positionSize))}{" "}
                            {position.asset}
                          </span>
                          <span className="text-secondary-foreground text-xs">
                            {formatAmount(Number(position.leverage))}x leverage
                            • {formatAmount(Number(position.collateralAmount))}{" "}
                            collateral
                          </span>
                          {position.pnlUsdValue && (
                            <span className="text-secondary-foreground text-xs">
                              PnL:{" "}
                              <span
                                className={`text-xs ${Number(position.pnlUsdValue) >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {formatAmount(Number(position.pnlUsdValue))} USD
                              </span>
                            </span>
                          )}
                          {position.closedAt && (
                            <span className="text-secondary-foreground text-xs">
                              Closed{" "}
                              {shouldShowRelativeTimestamp(position.closedAt)
                                ? formatRelativeTime(position.closedAt)
                                : formatDateShort(position.closedAt, true)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Pagination
                      totalItems={closedPositionsData.pagination.total}
                      currentPage={
                        Math.floor(
                          closedPositionsOffset / LIMIT_POSITIONS_PER_PAGE,
                        ) + 1
                      }
                      itemsPerPage={LIMIT_POSITIONS_PER_PAGE}
                      onPageChange={handleClosedPositionsPageChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-400">No closed positions</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Predictions Tab */}
        <TabsContent
          value="predictions"
          className="m-0 flex-1 overflow-hidden border"
        >
          <PredictionsTabContent competition={competition} />
        </TabsContent>

        {/* Info Tab */}
        <TabsContent
          value="info"
          className="m-0 flex-1 overflow-hidden md:border"
        >
          <div className="h-full overflow-y-auto">
            {competition.status !== "ended" && (
              <div className="border-b bg-[#0C0D12] px-4 py-2">
                <CompetitionStateSummary competition={competition} />
              </div>
            )}

            {/* Skills Row */}
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

            {/* Ranked by Row - Only for perps competitions */}
            {isPerpsCompetition && competition.evaluationMetric && (
              <div className="grid grid-cols-1 border-b">
                <div className="flex flex-col items-start gap-2 p-4">
                  <CellTitle>Ranked by</CellTitle>
                  <Tooltip content="The primary metric used to rank agents in this competition">
                    <span className="flex items-center gap-2 font-bold">
                      {getEvaluationMetricDisplayName(
                        competition.evaluationMetric,
                      )}
                      <Info className="h-4 w-4 text-gray-400" />
                    </span>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Rewards Row */}
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
                <p className="font-bold">TBA</p>
              )}
            </div>

            {/* Duration and Boost Window Row */}
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

            {/* Minimum Agent Stake and Registration Limit Row */}
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

            {/* About Row */}
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
                  className="mt-2 self-start transition-colors"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                >
                  {expanded ? "SHOW LESS" : "SHOW MORE"}
                </button>
              )}
            </div>

            {/* Total Positions, Volume, and Average Equity/Tokens Traded Row */}
            <div className="grid grid-cols-3 border-b">
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

            {/* Disclaimer Row */}
            <div className="p-4">
              <div className="text-secondary-foreground text-xs">
                Recall reserves the right to modify or cancel rules,
                eligibility, prize amounts, formats, and schedules at any time
                before the official start of the competition.
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
      openPositionsData,
      closedPositionsData,
      isLoadingOpenPositions,
      isLoadingClosedPositions,
      tradesOffset,
      openPositionsOffset,
      closedPositionsOffset,
      handleTradesPageChange,
      handleOpenPositionsPageChange,
      handleClosedPositionsPageChange,

      rules,
      rulesLoading,
      expanded,
      balancesExpanded,
      tradingRulesExpanded,
      chainsExpanded,
      rateLimitsExpanded,
      competition,
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
          className="fixed bottom-10 right-6 z-40 flex items-center gap-2 border-white bg-black px-4 py-3 font-semibold uppercase text-white shadow-lg hover:bg-white hover:text-black"
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

/**
 * PredictionsTabContent component displays boost allocations for a competition
 */
const PredictionsTabContent: React.FC<{
  competition: RouterOutputs["competitions"]["getById"];
}> = ({ competition }) => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useCompetitionBoosts(competition.id, 50, true, competition.status);

  // Flatten all pages into a single array
  const boosts = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <SkeletonList count={10} type="trade" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <BoostIcon className="mb-4 size-8" />
        <p className="text-red-400">Failed to load boost predictions</p>
      </div>
    );
  }

  if (boosts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <BoostIcon className="mb-4 size-8" />
        <p className="text-sm text-gray-400">
          {competition.status === "ended"
            ? "No boosts found for this competition"
            : "No boosts yet for this competition"}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div>
        <div className="space-y-3">
          {boosts.map((boost, index) => {
            const timestamp = new Date(boost.createdAt);
            const showRelative = shouldShowRelativeTimestamp(timestamp);

            return (
              <div
                key={`${boost.userId}-${boost.agentId}-${index}`}
                className="flex items-start justify-between gap-4 border-b border-gray-800 pb-3 last:border-0"
              >
                {/* Left column: User wallet address */}
                <div className="flex items-center gap-2">
                  <Tooltip
                    content={boost.wallet}
                    tooltipClassName="max-w-md z-999"
                  >
                    <span className="font-mono">
                      {displayAddress(boost.wallet, { numChars: 6 })}
                    </span>
                  </Tooltip>
                </div>

                {/* Right column: Agent name + Boost details */}
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs text-gray-400">
                    <Link
                      href={`/agents/${boost.agentId}`}
                      className="text-xs font-semibold hover:underline"
                    >
                      {boost.agentName}
                    </Link>
                    {" • "}
                    {formatBigintAmount(boost.amount)} BOOST
                  </span>
                  <span className="text-xs text-gray-500">
                    {showRelative
                      ? formatRelativeTime(timestamp)
                      : formatDateShort(timestamp, true)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="mt-4">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
              className="w-full"
            >
              {isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionKey;
