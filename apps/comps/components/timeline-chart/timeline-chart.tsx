"use client";

import { ChevronDown } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { config } from "@/config/public";
import { useCompetitionTimeline } from "@/hooks/useCompetitionTimeline";
import { checkIsPerpsCompetition } from "@/utils/competition-utils";

import { ShareModal } from "../share-modal";
import { MetricTimelineChart } from "./chart-template";
import { PortfolioChartProps } from "./types";

/**
 * Main TimelineChart component
 */
export const TimelineChart: React.FC<PortfolioChartProps> = ({
  competition,
  agents,
  className,
}) => {
  const isPerpsCompetition = checkIsPerpsCompetition(competition.type);
  const [activeChartTab, setActiveChartTab] = useState("account-value");
  const [dateRange, setDateRange] = useState<"all" | "72h">("all");

  const { data: timelineRaw, isLoading } = useCompetitionTimeline(
    competition.id,
    competition.status,
  );

  const { id } = competition;
  const startDate = competition.startDate;
  const boostStartDate = competition.boostStartDate;
  const competitionStatus = competition.status;
  const showDateRange = competitionStatus !== "ended";

  // For perps competitions, render charts with tabs
  if (isPerpsCompetition) {
    return (
      <div className={cn("w-full", className)}>
        <Tabs
          value={activeChartTab}
          onValueChange={setActiveChartTab}
          className="w-full"
        >
          {/* Chart Tabs Header */}
          <div className="flex items-center justify-between pb-2">
            {/* Desktop tabs - hidden on small screens */}
            <TabsList className="hidden flex-wrap gap-2 sm:flex">
              <TabsTrigger
                value="account-value"
                className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Return %
              </TabsTrigger>
              <TabsTrigger
                value="calmar-ratio"
                className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Calmar Ratio
              </TabsTrigger>
              <TabsTrigger
                value="max-drawdown"
                className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Max Drawdown
              </TabsTrigger>
              <TabsTrigger
                value="sortino-ratio"
                className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Sortino Ratio
              </TabsTrigger>
            </TabsList>

            {/* Mobile dropdown - shown only on small screens */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto border border-white bg-black px-3 py-2.5 text-xs font-semibold uppercase text-white hover:bg-white hover:text-black"
                  >
                    {activeChartTab === "account-value" && "% Return"}
                    {activeChartTab === "calmar-ratio" && "Calmar Ratio"}
                    {activeChartTab === "max-drawdown" && "Max Drawdown"}
                    {activeChartTab === "sortino-ratio" && "Sortino Ratio"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => setActiveChartTab("account-value")}
                    className="border-0.5 cursor-pointer border-b p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                  >
                    Return %
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveChartTab("calmar-ratio")}
                    className="border-0.5 cursor-pointer border-b p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                  >
                    Calmar Ratio
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveChartTab("max-drawdown")}
                    className="border-0.5 cursor-pointer border-b p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                  >
                    Max Drawdown
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveChartTab("sortino-ratio")}
                    className="border-0.5 cursor-pointer p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                  >
                    Sortino Ratio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mr-6 flex items-center gap-4">
              {showDateRange && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setDateRange("all")}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black",
                      dateRange === "all" && "bg-white text-black",
                    )}
                  >
                    All
                  </Button>
                  <Button
                    onClick={() => setDateRange("72h")}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black",
                      dateRange === "72h" && "bg-white text-black",
                    )}
                  >
                    72h
                  </Button>
                </div>
              )}
              <ShareModal
                title="Share performance metrics"
                url={`${config.frontendUrl}/competitions/${id}/chart`}
                size={20}
              />
            </div>
          </div>

          {/* Account Value Tab */}
          <TabsContent value="account-value" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="simpleReturn"
              yAxisType="percentage"
              isLoading={isLoading}
              status={competitionStatus}
              startDate={startDate}
              boostStartDate={boostStartDate}
              dateRange={dateRange}
            />
          </TabsContent>

          {/* Calmar Ratio Tab */}
          <TabsContent value="calmar-ratio" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="calmarRatio"
              isLoading={isLoading}
              status={competitionStatus}
              startDate={startDate}
              boostStartDate={boostStartDate}
              dateRange={dateRange}
            />
          </TabsContent>

          {/* Max Drawdown Tab */}
          <TabsContent value="max-drawdown" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="maxDrawdown"
              yAxisType="percentage"
              isLoading={isLoading}
              status={competitionStatus}
              startDate={startDate}
              boostStartDate={boostStartDate}
              dateRange={dateRange}
            />
          </TabsContent>

          {/* Sortino Ratio Tab */}
          <TabsContent value="sortino-ratio" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="sortinoRatio"
              isLoading={isLoading}
              status={competitionStatus}
              startDate={startDate}
              boostStartDate={boostStartDate}
              dateRange={dateRange}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <Tabs
        value={activeChartTab}
        onValueChange={setActiveChartTab}
        className="w-full"
      >
        {/* Chart Tabs Header */}
        <div className="flex items-center justify-between pb-2">
          <TabsList className="hidden flex-wrap gap-2 sm:flex">
            <TabsTrigger
              value="account-value"
              className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Account Value
            </TabsTrigger>
            <TabsTrigger
              value="percent-return"
              className="border border-white bg-black px-4 py-2 font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              % Return
            </TabsTrigger>
          </TabsList>

          {/* Mobile dropdown - shown only on small screens */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto border border-white bg-black px-3 py-2.5 text-xs font-semibold uppercase text-white hover:bg-white hover:text-black"
                >
                  {activeChartTab === "account-value" && "Account Value"}
                  {activeChartTab === "percent-return" && "% Return"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setActiveChartTab("account-value")}
                  className="border-0.5 cursor-pointer border-b p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                >
                  Account Value
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveChartTab("percent-return")}
                  className="border-0.5 cursor-pointer border-b p-3 font-mono text-xs font-semibold uppercase hover:bg-gray-800"
                >
                  % Return
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mr-6 flex items-center gap-4">
            {showDateRange && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setDateRange("all")}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black",
                    dateRange === "all" && "bg-white text-black",
                  )}
                >
                  All
                </Button>
                <Button
                  onClick={() => setDateRange("72h")}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black",
                    dateRange === "72h" && "bg-white text-black",
                  )}
                >
                  72h
                </Button>
              </div>
            )}
            <ShareModal
              title="Share performance metrics"
              url={`${config.frontendUrl}/competitions/${id}/chart`}
              size={20}
            />
          </div>
        </div>

        {/* Account Value Tab */}
        <TabsContent value="account-value" className="m-0">
          <MetricTimelineChart
            timelineData={timelineRaw || []}
            agents={agents || []}
            metric="totalValue"
            yAxisType="currency"
            isLoading={isLoading}
            status={competitionStatus}
            startDate={startDate}
            boostStartDate={boostStartDate}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* % Gain Tab */}
        <TabsContent value="percent-return" className="m-0">
          <MetricTimelineChart
            timelineData={timelineRaw || []}
            agents={agents || []}
            metric="percentReturn"
            yAxisType="percentage"
            isLoading={isLoading}
            status={competitionStatus}
            startDate={startDate}
            boostStartDate={boostStartDate}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
