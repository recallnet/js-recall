"use client";

import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
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
  const isPerpsCompetition = checkIsPerpsCompetition(competition);
  const [activeChartTab, setActiveChartTab] = useState("account-value");
  const [dateRange, setDateRange] = useState<"all" | "72h">("72h");

  const { data: timelineRaw, isLoading } = useCompetitionTimeline(
    competition.id,
    competition.status,
  );

  const { id } = competition;
  const showDateRange = competition.status !== "ended";

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
            <TabsList className="flex flex-wrap gap-2">
              <TabsTrigger
                value="account-value"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Account Value
              </TabsTrigger>
              <TabsTrigger
                value="calmar-ratio"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Calmar Ratio
              </TabsTrigger>
              <TabsTrigger
                value="max-drawdown"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Max Drawdown
              </TabsTrigger>
              <TabsTrigger
                value="sortino-ratio"
                className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Sortino Ratio
              </TabsTrigger>
            </TabsList>
            <div className="mr-6 flex items-center gap-4">
              {showDateRange && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setDateRange("all")}
                    variant="outline"
                    size="sm"
                    className={cn(
                      (className =
                        "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"),
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
                      (className =
                        "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"),
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
                className="hidden sm:block"
              />
            </div>
          </div>

          {/* Account Value Tab */}
          <TabsContent value="account-value" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="simpleReturn"
              isLoading={isLoading}
              status={competition.status}
              startDate={competition.startDate}
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
              status={competition.status}
              startDate={competition.startDate}
              dateRange={dateRange}
            />
          </TabsContent>

          {/* Max Drawdown Tab */}
          <TabsContent value="max-drawdown" className="m-0">
            <MetricTimelineChart
              timelineData={timelineRaw || []}
              agents={agents || []}
              metric="maxDrawdown"
              isLoading={isLoading}
              status={competition.status}
              startDate={competition.startDate}
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
              status={competition.status}
              startDate={competition.startDate}
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
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger
              value="account-value"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Account Value
            </TabsTrigger>
            <TabsTrigger
              value="percent-gain"
              className="border border-white bg-black px-4 py-2 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black"
            >
              % Gain
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-4">
            {showDateRange && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setDateRange("72h")}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto border border-white bg-black px-3 py-1.5 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black",
                    dateRange === "72h" && "bg-white text-black",
                  )}
                >
                  Past 72 Hours
                </Button>
                <Button
                  onClick={() => setDateRange("all")}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto border border-white bg-black px-3 py-1.5 text-xs font-semibold uppercase text-white transition-colors duration-200 hover:bg-white hover:text-black",
                    dateRange === "all" && "bg-white text-black",
                  )}
                >
                  All
                </Button>
              </div>
            )}
            <ShareModal
              title="Share performance metrics"
              url={`${config.frontendUrl}/competitions/${id}/chart`}
              size={20}
              className="hidden sm:block"
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
            status={competition.status}
            startDate={competition.startDate}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* % Gain Tab */}
        <TabsContent value="percent-gain" className="m-0">
          <MetricTimelineChart
            timelineData={timelineRaw || []}
            agents={agents || []}
            metric="totalValue"
            yAxisType="percentage"
            isLoading={isLoading}
            status={competition.status}
            startDate={competition.startDate}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
