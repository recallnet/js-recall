"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
import { RouterOutputs } from "@/rpc/router";
import { checkIsPerpsCompetition } from "@/utils/competition-utils";
import { formatDate } from "@/utils/format";

import { ShareModal } from "../share-modal";
import { ChartSkeleton } from "./chart-skeleton";
import { ChartWrapper } from "./chart-wrapper";
import {
  CHART_COLORS,
  HoverContext,
  LIMIT_AGENTS_PER_CHART,
} from "./constants";
import { CustomLegend } from "./custom-legend";
import { MetricTimelineChart } from "./metric-timeline-chart";
import { PortfolioChartProps, TimelineViewRecord } from "./types";
import { datesByWeek, formatDateShort } from "./utils";

/**
 * Main TimelineChart component
 */
export const TimelineChart: React.FC<PortfolioChartProps> = ({
  competition,
  agents,
  className,
  suppressInternalLoading = false,
}) => {
  const isPerpsCompetition = checkIsPerpsCompetition(competition);
  const [activeChartTab, setActiveChartTab] = useState("account-value");

  const { data: timelineRaw, isLoading } = useCompetitionTimeline(
    competition.id,
    competition.status,
  );
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [shouldAnimate] = useState(false); // Disable animation for better performance
  const [hoveredDataPoint, setHoveredDataPoint] = useState<Record<
    string,
    number
  > | null>(null);
  const [hoveredOrder, setHoveredOrder] = useState<string[]>([]);

  // Use a ref to track the last hover data to prevent unnecessary updates
  const lastHoverDataRef = useRef<string>("");
  const handleHoverChange = useCallback(
    (data: Record<string, number> | null, order?: string[]) => {
      const dataKey = data ? JSON.stringify(data) : "";
      if (dataKey !== lastHoverDataRef.current) {
        lastHoverDataRef.current = dataKey;
        setHoveredDataPoint(data);
        setHoveredOrder(order || []);
      }
    },
    [],
  );

  // Use state to track legend hover for line highlighting
  const [legendHoveredAgent, setLegendHoveredAgent] = useState<string | null>(
    null,
  );

  const handleLegendHover = useCallback((agentName: string | null) => {
    setLegendHoveredAgent(agentName);
  }, []);

  const parsedData = useMemo(() => {
    if (!timelineRaw) return [];

    const dateMap: TimelineViewRecord = timelineRaw.reduce((acc, cur) => {
      const curMap: TimelineViewRecord = cur.timeline.reduce((cacc, ccur) => {
        const nxt = { agent: cur.agentName, amount: ccur.totalValue };
        const current = cacc[ccur.timestamp as keyof typeof cacc];
        return {
          ...cacc,
          [ccur.timestamp]: current ? [...current, nxt] : [nxt],
        };
      }, {});

      for (const dateEntry of Object.keys(curMap)) {
        if (acc[dateEntry]) {
          const a = acc[dateEntry] as { agent: string; amount: number }[];
          const b = curMap[dateEntry] as { agent: string; amount: number }[];
          acc[dateEntry] = [...a, ...b];
        } else {
          acc[dateEntry] = curMap[dateEntry] as {
            agent: string;
            amount: number;
          }[];
        }
      }

      return acc;
    }, {} as TimelineViewRecord);

    const dateArr = Object.entries(dateMap);
    const sortedAndTransformed = dateArr
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map((entry) => {
        const points = entry[1].reduce(
          (acc, cur) => ({
            ...acc,
            [cur.agent]: cur.amount,
          }),
          {},
        );

        return { timestamp: entry[0], ...points };
      });

    return datesByWeek(sortedAndTransformed);
  }, [timelineRaw]);

  const { id, status, startDate, endDate } = competition;

  // Intelligent date range selection based on competition status and dates
  useEffect(() => {
    if (!parsedData.length) return;

    const now = new Date();
    let targetIndex = parsedData.length - 1; // Default to most recent week

    if (status === "active") {
      // For active competitions, show the current week or the most recent week with data
      const currentWeekData = parsedData.findIndex((weekData) => {
        if (!weekData || !weekData.length) return false;
        const weekStart = new Date(weekData[0]!.timestamp);
        const weekEnd = new Date(weekData[weekData.length - 1]!.timestamp);
        return weekStart <= now && weekEnd >= now;
      });

      if (currentWeekData !== -1) {
        targetIndex = currentWeekData;
      }
    } else if (status === "ended") {
      // For ended competitions, show the last week of the competition
      if (endDate) {
        const endWeekData = parsedData.findIndex((weekData) => {
          if (!weekData || !weekData.length) return false;
          const weekEnd = new Date(weekData[weekData.length - 1]!.timestamp);
          return weekEnd >= endDate;
        });

        if (endWeekData !== -1) {
          targetIndex = endWeekData;
        }
      }
    }

    setDateRangeIndex(targetIndex);
  }, [parsedData, status, startDate, endDate]);

  const filteredData = useMemo(() => {
    // For ended competitions, show all data in a single view
    if (status === "ended" && parsedData.length > 0) {
      // Flatten all weeks into a single array
      const allData = parsedData.flat();

      // Calculate competition duration to determine granularity
      const durationInDays =
        startDate && endDate
          ? Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      // For short competitions (1-2 days), preserve high granularity
      // For longer competitions (3+ days), use daily grouping
      if (durationInDays <= 2) {
        // Sort all data by timestamp
        const sortedData = allData.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        // Group data by timestamp to ensure consistency across agents
        const timestampGroups = new Map();
        sortedData.forEach((data) => {
          if (!timestampGroups.has(data.timestamp)) {
            timestampGroups.set(data.timestamp, []);
          }
          timestampGroups.get(data.timestamp).push(data);
        });

        // Get all unique timestamps and decide which ones to include
        const allTimestamps = Array.from(timestampGroups.keys()).sort();
        let selectedTimestamps: string[];

        if (allTimestamps.length > 100) {
          // For too many timestamps, sample evenly but always include first and last
          const step = Math.ceil(allTimestamps.length / 98); // 98 + first + last = 100
          selectedTimestamps = allTimestamps.filter(
            (_, index) =>
              index === 0 ||
              index === allTimestamps.length - 1 ||
              index % step === 0,
          );
        } else {
          // Keep all timestamps if reasonable number
          selectedTimestamps = allTimestamps;
        }

        // Get all unique agent names
        const allAgents = new Set<string>();
        sortedData.forEach((data) => {
          Object.keys(data).forEach((key) => {
            if (
              key !== "timestamp" &&
              typeof (data as Record<string, unknown>)[key] === "number"
            ) {
              allAgents.add(key);
            }
          });
        });

        // Initialize all agents with their first known values
        const agentFirstValues: Record<string, number> = {};
        allAgents.forEach((agentName) => {
          // Find the first data point for this agent
          for (const data of sortedData) {
            const value = (data as Record<string, unknown>)[agentName];
            if (typeof value === "number") {
              agentFirstValues[agentName] = value;
              break;
            }
          }
        });

        // Build the final dataset with consistent timestamps and forward-fill missing values
        const result: Array<Record<string, string | number>> = [];
        const lastValues: Record<string, number> = { ...agentFirstValues }; // Initialize with first values

        selectedTimestamps.forEach((timestamp) => {
          const groupData = timestampGroups.get(timestamp);
          const combinedData: Record<string, string | number> = {
            timestamp,
            originalTimestamp: timestamp,
            displayTimestamp: formatDate(timestamp),
          };

          // Update last known values with any new data at this timestamp
          if (groupData) {
            groupData.forEach((item: Record<string, string | number>) => {
              Object.keys(item).forEach((key) => {
                if (key !== "timestamp" && typeof item[key] === "number") {
                  lastValues[key] = item[key] as number;
                }
              });
            });
          }

          // Apply current values (forward-filled) for all agents
          allAgents.forEach((agentName) => {
            if (lastValues[agentName] !== undefined) {
              combinedData[agentName] = lastValues[agentName];
            }
          });

          result.push(combinedData);
        });

        return result;
      } else {
        // For longer competitions, group by day as before
        const uniqueDates = new Map();
        allData.forEach((data) => {
          const dateKey = formatDate(data.timestamp);
          // Keep the last data point for each date
          uniqueDates.set(dateKey, {
            ...data,
            timestamp: dateKey,
          });
        });
        return Array.from(uniqueDates.values());
      }
    }

    // For other statuses (active/pending), preserve full granularity
    return (parsedData[dateRangeIndex] || []).map((data) => ({
      ...data,
      // Keep original timestamp for hover precision, but add formatted version for display
      originalTimestamp: data.timestamp,
      timestamp: data.timestamp, // Keep original for hover granularity
      displayTimestamp: formatDate(data.timestamp), // For axis labels
    }));
  }, [parsedData, dateRangeIndex, status, startDate, endDate]);

  // Get all agent keys from the data (unfiltered)
  const allDataKeys = useMemo(() => {
    const res: Record<string, number> = filteredData.reduce(
      (acc, cur) => ({
        ...acc,
        ...cur,
      }),
      {},
    );

    // Filter out all timestamp-related keys
    const timestampKeys = [
      "timestamp",
      "originalTimestamp",
      "displayTimestamp",
    ];
    timestampKeys.forEach((key) => {
      if (res[key]) delete res[key];
    });

    return Object.keys(res);
  }, [filteredData]);

  // All agents that have timeline data (for search functionality)
  const allTimelineAgents = useMemo(() => {
    if (!timelineRaw) return [];

    // Extract all unique agent names from timeline data
    const agentNames = new Set<string>();
    timelineRaw.forEach((agentTimeline) => {
      agentNames.add(agentTimeline.agentName);
    });

    // Map timeline agents to our format, only including agents that exist in the agents prop
    return Array.from(agentNames)
      .map((agentName) => agents?.find((agent) => agent.name === agentName))
      .filter(
        (
          agent,
        ): agent is RouterOutputs["competitions"]["getAgents"]["agents"][number] =>
          agent !== undefined,
      );
  }, [timelineRaw, agents]);

  // Current page agents with data - only show agents from the current pagination page when NOT searching
  const allAgentsWithData = useMemo(() => {
    // If searching, use all timeline agents for filtering
    if (debouncedSearchQuery) {
      return allTimelineAgents.filter((agent) =>
        allDataKeys.some((agentName) => agentName === agent?.name),
      );
    }

    // If not searching, use current page agents
    if (!agents || agents.length === 0) return [];
    return agents.filter((agent) =>
      allDataKeys.some((agentName) => agentName === agent.name),
    );
  }, [agents, allDataKeys, allTimelineAgents, debouncedSearchQuery]);

  // Filtered agents for the legend (based on search query)
  const filteredAgentsForLegend = useMemo(() => {
    if (!debouncedSearchQuery) return allAgentsWithData;
    const lowercaseQuery = debouncedSearchQuery.toLowerCase();
    return allAgentsWithData.filter((agent) =>
      agent.name.toLowerCase().includes(lowercaseQuery),
    );
  }, [allAgentsWithData, debouncedSearchQuery]);

  // Current legend page state for search pagination tracking
  const [currentLegendPage, setCurrentLegendPage] = useState(1);

  // Handle search page changes from CustomLegend
  const handleSearchPageChange = useCallback((page: number) => {
    setCurrentLegendPage(page);
  }, []);

  // Reset legend page when search query changes
  useEffect(() => {
    setCurrentLegendPage(1);
  }, [debouncedSearchQuery]);

  // Chart display agents - should match what's shown in the legend's current page
  const chartDisplayAgents = useMemo(() => {
    if (!debouncedSearchQuery) {
      // When not searching, use current page agents
      return allAgentsWithData;
    } else {
      // When searching, show agents from current search page
      const startIndex = (currentLegendPage - 1) * LIMIT_AGENTS_PER_CHART;
      const endIndex = startIndex + LIMIT_AGENTS_PER_CHART;
      return filteredAgentsForLegend.slice(startIndex, endIndex) || [];
    }
  }, [
    allAgentsWithData,
    filteredAgentsForLegend,
    debouncedSearchQuery,
    currentLegendPage,
  ]);

  // Get chart-visible agent keys (limited for performance)
  const chartVisibleAgentKeys = useMemo(() => {
    const agentNamesSet = new Set(
      chartDisplayAgents.map((agent) => agent.name),
    );
    return allDataKeys.filter((agentName) => agentNamesSet.has(agentName));
  }, [allDataKeys, chartDisplayAgents]);

  // Filter data keys based on search (limited to chart-visible agents)
  const filteredDataKeys = useMemo(() => {
    if (!debouncedSearchQuery) return chartVisibleAgentKeys;
    const lowercaseQuery = debouncedSearchQuery.toLowerCase();
    return chartVisibleAgentKeys.filter((agent) =>
      agent.toLowerCase().includes(lowercaseQuery),
    );
  }, [chartVisibleAgentKeys, debouncedSearchQuery]);

  // Create a consistent color mapping for chart-visible agents
  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    chartVisibleAgentKeys.forEach((agentName, index) => {
      map[agentName] = CHART_COLORS[index % CHART_COLORS.length]!;
    });
    return map;
  }, [chartVisibleAgentKeys]);

  // Get the latest data point values
  const latestValues = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return {};
    const lastDataPoint = filteredData[filteredData.length - 1];
    if (!lastDataPoint) return {};
    const values: Record<string, number> = {};
    Object.entries(lastDataPoint).forEach(([key, value]) => {
      if (key !== "timestamp" && typeof value === "number") {
        values[key] = value;
      }
    });
    return values;
  }, [filteredData]);

  const handlePrevRange = () => {
    setDateRangeIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextRange = () => {
    setDateRangeIndex((prev) => Math.min(parsedData.length - 1, prev + 1));
  };

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
          <div className="flex items-center justify-between px-6 pb-2">
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
            <ShareModal
              title="Share performance metrics"
              url={`${config.frontendUrl}/competitions/${id}/chart`}
              size={20}
              className="hidden sm:block"
            />
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
              endDate={competition.endDate}
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
              endDate={competition.endDate}
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
              endDate={competition.endDate}
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
              endDate={competition.endDate}
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
        <div className="flex items-center justify-between px-6 pb-2">
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
          <ShareModal
            title="Share performance metrics"
            url={`${config.frontendUrl}/competitions/${id}/chart`}
            size={20}
            className="hidden sm:block"
          />
        </div>

        {/* Account Value Tab */}
        <TabsContent value="account-value" className="m-0">
          {isLoading && !suppressInternalLoading ? (
            <ChartSkeleton />
          ) : (timelineRaw && timelineRaw?.length <= 0) ||
            status === "pending" ? (
            <div className="h-30 flex w-full flex-col items-center justify-center p-10">
              <span className="text-primary-foreground">
                {status === "pending"
                  ? "Competition hasn't started yet"
                  : "No agents competing yet"}
              </span>
              <span className="text-secondary-foreground text-sm">
                {status === "pending" && startDate
                  ? `The competition will start on ${formatDate(startDate)}.`
                  : "Agents will appear here as soon as the competition starts."}
              </span>
            </div>
          ) : (
            <>
              {status !== "ended" && filteredData.length > 0 && (
                <div className="flex w-full items-center justify-end px-6 py-4">
                  <div className="text-secondary-foreground flex items-center gap-3 text-sm">
                    <Button
                      onClick={handlePrevRange}
                      disabled={dateRangeIndex <= 0}
                      variant="outline"
                      className="hover:text-primary-foreground border-none p-0 hover:bg-black"
                    >
                      <ChevronLeft strokeWidth={1.5} />
                    </Button>
                    <div className="flex items-center gap-2">
                      <span>
                        {filteredData[0]?.originalTimestamp
                          ? formatDateShort(filteredData[0].originalTimestamp)
                          : formatDateShort(
                              filteredData[0]?.timestamp as string,
                            )}
                      </span>
                      <span className="text-secondary-foreground">/</span>
                      <span>
                        {(() => {
                          const lastItem =
                            filteredData[filteredData.length - 1];
                          return lastItem?.originalTimestamp
                            ? formatDateShort(lastItem.originalTimestamp)
                            : formatDateShort(lastItem?.timestamp as string);
                        })()}
                      </span>
                    </div>
                    <Button
                      onClick={handleNextRange}
                      disabled={dateRangeIndex >= parsedData.length - 1}
                      variant="outline"
                      className="hover:text-primary-foreground border-none p-0 hover:bg-black"
                    >
                      <ChevronRight strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              )}

              <div className="h-120 relative">
                <HoverContext.Provider
                  value={{
                    hoveredAgent: legendHoveredAgent,
                    setHoveredAgent: setLegendHoveredAgent,
                  }}
                >
                  <ChartWrapper
                    filteredData={filteredData}
                    filteredDataKeys={filteredDataKeys}
                    agentColorMap={agentColorMap}
                    shouldAnimate={shouldAnimate}
                    isFullRange={status === "ended"}
                    onHoverChange={handleHoverChange}
                  />
                </HoverContext.Provider>
              </div>
              <div className="border-t-1 my-2 w-full"></div>
              <CustomLegend
                agents={filteredAgentsForLegend}
                colorMap={agentColorMap}
                currentValues={hoveredDataPoint || latestValues}
                currentOrder={hoveredOrder}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAgentHover={handleLegendHover}
                onSearchPageChange={handleSearchPageChange}
              />
            </>
          )}
        </TabsContent>

        {/* % Gain Tab */}
        <TabsContent value="percent-gain" className="m-0">
          <MetricTimelineChart
            timelineData={timelineRaw || []}
            agents={agents || []}
            metric="simpleReturn"
            isLoading={isLoading}
            status={competition.status}
            startDate={competition.startDate}
            endDate={competition.endDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
