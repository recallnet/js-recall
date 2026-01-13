"use client";

import { ChevronDown, ExternalLink, Info, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { SpecificChain } from "@recallnet/services/types";
import { Button } from "@recallnet/ui2/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import {
  CellTitle,
  CompetitionInfoSections,
} from "@/components/competition-key-info";
import { Pagination } from "@/components/pagination";
import { useCompetitionRules } from "@/hooks";
import { useCompetitionPerpsPositions } from "@/hooks/useCompetitionPerpsPositions";
import { useCompetitionTrades } from "@/hooks/useCompetitionTrades";
import { RouterOutputs } from "@/rpc/router";
import {
  LIMIT_ITEMS_PER_PAGE,
  checkIsPerpsCompetition,
  checkIsSpotLiveCompetition,
  shouldShowRelativeTimestamp,
} from "@/utils/competition-utils";
import {
  formatAmount,
  formatDateShort,
  formatRelativeTime,
} from "@/utils/format";

import { AgentAvatar } from "./agent-avatar";
import { BoostsTabContent } from "./competition-key-boost";
import { SkeletonList } from "./skeleton-loaders";

/**
 * Maps chain identifiers to their block explorer transaction URLs.
 * Using SpecificChain type ensures compile-time safety if chains are added/removed.
 */
const CHAIN_EXPLORER_TX_URLS: Record<SpecificChain, string> = {
  // EVM chains
  eth: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  avalanche: "https://snowscan.xyz/tx/",
  base: "https://basescan.org/tx/",
  linea: "https://lineascan.build/tx/",
  zksync: "https://explorer.zksync.io/tx/",
  scroll: "https://scrollscan.com/tx/",
  mantle: "https://explorer.mantle.xyz/tx/",
  // SVM chains
  svm: "https://solscan.io/tx/",
};

/**
 * Type guard to check if a string is a valid SpecificChain
 */
function isSpecificChain(chain: string): chain is SpecificChain {
  return chain in CHAIN_EXPLORER_TX_URLS;
}

/**
 * Gets the block explorer URL for a transaction hash on a given chain
 */
function getExplorerTxUrl(
  txHash: string,
  chain: string | null | undefined,
): string | null {
  if (!txHash || !chain) return null;
  const normalizedChain = chain.toLowerCase();
  if (!isSpecificChain(normalizedChain)) return null;
  return `${CHAIN_EXPLORER_TX_URLS[normalizedChain]}${txHash}`;
}

export interface CompetitionKeyProps {
  competition: RouterOutputs["competitions"]["getById"];
  className?: string;
}

/**
 * CompetitionKey component displays tabs with trades, positions, predictions, info, and rules.
 * On mobile, it's accessible via a "View Details" button that opens a dialog.
 */
export const CompetitionKey: React.FC<CompetitionKeyProps> = ({
  competition,
  className,
}) => {
  const isPerpsCompetition = checkIsPerpsCompetition(competition.type);
  const isSpotLiveCompetition = checkIsSpotLiveCompetition(competition.type);
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
      limit: LIMIT_ITEMS_PER_PAGE,
    },
    !isPerpsCompetition,
    competition.status,
  );

  const { data: openPositionsData, isLoading: isLoadingOpenPositions } =
    useCompetitionPerpsPositions(
      competition.id,
      {
        offset: openPositionsOffset,
        limit: LIMIT_ITEMS_PER_PAGE,
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
        limit: LIMIT_ITEMS_PER_PAGE,
        status: "Closed",
      },
      isPerpsCompetition,
      competition.status,
    );

  const handleTradesPageChange = useCallback((page: number) => {
    setTradesOffset(LIMIT_ITEMS_PER_PAGE * (page - 1));
  }, []);

  const handleOpenPositionsPageChange = useCallback((page: number) => {
    setOpenPositionsOffset(LIMIT_ITEMS_PER_PAGE * (page - 1));
  }, []);

  const handleClosedPositionsPageChange = useCallback((page: number) => {
    setClosedPositionsOffset(LIMIT_ITEMS_PER_PAGE * (page - 1));
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
            value="boosts"
            className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Boosts
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Info
          </TabsTrigger>
          {!isPerpsCompetition && !isSpotLiveCompetition && (
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
                          {(() => {
                            const explorerUrl =
                              trade.txHash &&
                              getExplorerTxUrl(
                                trade.txHash,
                                trade.fromSpecificChain,
                              );
                            const tradeContent = (
                              <span className="text-xs text-gray-400">
                                {formatAmount(trade.fromAmount)}{" "}
                                {trade.fromTokenSymbol} →{" "}
                                {formatAmount(trade.toAmount)}{" "}
                                {trade.toTokenSymbol}
                              </span>
                            );
                            return explorerUrl ? (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-white"
                              >
                                {tradeContent}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              tradeContent
                            );
                          })()}
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
                        Math.floor(tradesOffset / LIMIT_ITEMS_PER_PAGE) + 1
                      }
                      itemsPerPage={LIMIT_ITEMS_PER_PAGE}
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
                          {(position.leverage !== null ||
                            position.collateralAmount !== null) && (
                            <span className="text-secondary-foreground text-xs">
                              {position.leverage !== null &&
                                `${formatAmount(Number(position.leverage))}x leverage`}
                              {position.leverage !== null &&
                                position.collateralAmount !== null &&
                                " • "}
                              {position.collateralAmount !== null &&
                                `${formatAmount(Number(position.collateralAmount))} collateral`}
                            </span>
                          )}
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
                        Math.floor(openPositionsOffset / LIMIT_ITEMS_PER_PAGE) +
                        1
                      }
                      itemsPerPage={LIMIT_ITEMS_PER_PAGE}
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
                          {(position.leverage !== null ||
                            position.collateralAmount !== null) && (
                            <span className="text-secondary-foreground text-xs">
                              {position.leverage !== null &&
                                `${formatAmount(Number(position.leverage))}x leverage`}
                              {position.leverage !== null &&
                                position.collateralAmount !== null &&
                                " • "}
                              {position.collateralAmount !== null &&
                                `${formatAmount(Number(position.collateralAmount))} collateral`}
                            </span>
                          )}
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
                          closedPositionsOffset / LIMIT_ITEMS_PER_PAGE,
                        ) + 1
                      }
                      itemsPerPage={LIMIT_ITEMS_PER_PAGE}
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

        {/* Boosts Tab */}
        <TabsContent
          value="boosts"
          className="m-0 flex-1 overflow-hidden border"
        >
          <BoostsTabContent competition={competition} />
        </TabsContent>

        {/* Info Tab */}
        <TabsContent
          value="info"
          className="m-0 flex-1 overflow-hidden md:border"
        >
          <CompetitionInfoSections
            competition={competition}
            showEvaluationMetric={isPerpsCompetition || isSpotLiveCompetition}
          />
        </TabsContent>

        {/* Rules Tab - hidden for perps and spot live (paper trading rules not applicable) */}
        {!isPerpsCompetition && !isSpotLiveCompetition && (
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
      isSpotLiveCompetition,
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
      balancesExpanded,
      tradingRulesExpanded,
      chainsExpanded,
      rateLimitsExpanded,
      competition,
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

export default CompetitionKey;
