"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@recallnet/ui2/components/button";

import { AgentAvatar } from "@/components/agent-avatar";
import { RouterOutputs } from "@/rpc/router";
import { formatDate } from "@/utils/format";

import { ChartSkeleton } from "./chart-skeleton";
import {
  CHART_COLORS,
  HoverContext,
  LIMIT_AGENTS_PER_CHART,
} from "./constants";
import { CustomLegend } from "./custom-legend";
import { datesByWeek, formatDateShort } from "./utils";

interface MetricTimelineChartProps {
  timelineData: RouterOutputs["competitions"]["getTimeline"];
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
  metric:
    | "calmarRatio"
    | "sortinoRatio"
    | "simpleReturn"
    | "annualizedReturn"
    | "maxDrawdown";
  isLoading?: boolean;
  status: "pending" | "active" | "ending" | "ended";
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Agent avatar dot component for the timeline chart
 */
const AgentAvatarDot = ({
  agent,
  cx,
  cy,
}: {
  agent: RouterOutputs["competitions"]["getAgents"]["agents"][number];
  cx: number;
  cy: number;
}) => {
  // Use larger container size to accommodate hover scaling over agent avatar
  const containerSize = 40;
  const avatarSize = 32;
  const offset = containerSize / 2;

  return (
    <g>
      <foreignObject
        x={cx - offset}
        y={cy - offset}
        width={containerSize}
        height={containerSize}
      >
        <div
          style={{
            width: containerSize,
            height: containerSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AgentAvatar agent={agent} size={avatarSize} />
        </div>
      </foreignObject>
    </g>
  );
};

/**
 * Generic metric timeline chart component that displays progression of a specific metric over time
 */
export const MetricTimelineChart: React.FC<MetricTimelineChartProps> = ({
  timelineData,
  agents,
  metric,
  isLoading = false,
  status,
  startDate,
  endDate,
}) => {
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [legendHoveredAgent, setLegendHoveredAgent] = useState<string | null>(
    null,
  );

  const handleLegendHover = useCallback((agentName: string | null) => {
    setLegendHoveredAgent(agentName);
  }, []);

  // Parse timeline data for the specific metric
  const parsedData = useMemo(() => {
    if (!timelineData) return [];

    // Build a map of all timestamps across all agents
    const allTimestamps = new Set<string>();
    timelineData.forEach((agent) => {
      agent.timeline.forEach((point) => {
        allTimestamps.add(point.timestamp);
      });
    });

    // Create data points for each timestamp
    const sortedTimestamps = Array.from(allTimestamps).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const result: Array<{
      timestamp: string;
      [key: string]: string | number | null;
    }> = sortedTimestamps.map((timestamp) => {
      const dataPoint: {
        timestamp: string;
        [key: string]: string | number | null;
      } = { timestamp };

      // For each agent, find their metric value at this timestamp
      timelineData.forEach((agent) => {
        const point = agent.timeline.find((p) => p.timestamp === timestamp);
        if (point) {
          const metricValue = point[metric];
          // Include the value even if it's null - connectNulls will handle it
          dataPoint[agent.agentName] = metricValue ?? null;
        } else {
          dataPoint[agent.agentName] = null;
        }
      });

      return dataPoint;
    });

    return datesByWeek(result);
  }, [timelineData, metric]);

  // Intelligent date range selection
  useEffect(() => {
    if (!parsedData.length) return;

    const now = new Date();
    let targetIndex = parsedData.length - 1;

    if (status === "active") {
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
    if (status === "ended" && parsedData.length > 0) {
      const allData = parsedData.flat();
      const durationInDays =
        startDate && endDate
          ? Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      if (durationInDays <= 2) {
        const sortedData = allData.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        return sortedData.map((data) => ({
          ...data,
          originalTimestamp: data.timestamp,
          displayTimestamp: formatDateShort(data.timestamp),
        }));
      } else {
        const uniqueDates = new Map();
        allData.forEach((data) => {
          const dateKey = formatDateShort(data.timestamp);
          uniqueDates.set(dateKey, {
            ...data,
            timestamp: data.timestamp,
            originalTimestamp: data.timestamp,
            displayTimestamp: dateKey,
          });
        });
        return Array.from(uniqueDates.values());
      }
    }

    return (parsedData[dateRangeIndex] || []).map((data) => ({
      ...data,
      originalTimestamp: data.timestamp,
      timestamp: data.timestamp,
      displayTimestamp: formatDateShort(data.timestamp),
    }));
  }, [parsedData, dateRangeIndex, status, startDate, endDate]);

  // Get all latest metric values
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

  // Get top agents based on the metric value
  const topAgents = useMemo(() => {
    const agentsWithValues = agents
      .map((agent) => ({
        agent,
        value: latestValues[agent.name] ?? -Infinity,
      }))
      .filter(({ value }) => value !== -Infinity && value !== null)
      .sort((a, b) => b.value - a.value)
      .slice(0, LIMIT_AGENTS_PER_CHART)
      .map(({ agent }) => agent);

    return agentsWithValues;
  }, [agents, latestValues]);

  const topAgentNames = useMemo(() => {
    return topAgents.map((agent) => agent.name);
  }, [topAgents]);

  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    topAgentNames.forEach((agentName, index) => {
      map[agentName] = CHART_COLORS[index % CHART_COLORS.length]!;
    });
    return map;
  }, [topAgentNames]);

  const handlePrevRange = () => {
    setDateRangeIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextRange = () => {
    setDateRangeIndex((prev) => Math.min(parsedData.length - 1, prev + 1));
  };

  if (isLoading) {
    return (
      <div className="h-120 w-full">
        <ChartSkeleton />
      </div>
    );
  }

  if (!timelineData || timelineData.length === 0 || status === "pending") {
    return (
      <div className="h-30 flex w-full flex-col items-center justify-center p-10">
        <span className="text-primary-foreground">
          {status === "pending"
            ? "Competition hasn't started yet"
            : "No data available"}
        </span>
        <span className="text-secondary-foreground text-sm">
          {status === "pending" && startDate
            ? `The competition will start on ${formatDate(startDate)}.`
            : "Data will appear here as the competition progresses."}
        </span>
      </div>
    );
  }

  return (
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
                  : formatDateShort(filteredData[0]?.timestamp as string)}
              </span>
              <span className="text-secondary-foreground">/</span>
              <span>
                {(() => {
                  const lastItem = filteredData[filteredData.length - 1];
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="displayTimestamp"
                stroke="#9CA3AF"
                fontSize={12}
                tick={{ fill: "#9CA3AF" }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tick={{ fill: "#9CA3AF" }}
                tickFormatter={(value) => value.toFixed(2)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const sortedPayload = [...payload].sort(
                      (a, b) => (b.value as number) - (a.value as number),
                    );

                    return (
                      <div className="bg-card z-50 rounded-lg border border-gray-600 p-3 shadow-lg">
                        <p className="text-secondary-foreground mb-2 text-xs">
                          {payload[0]?.payload?.displayTimestamp || ""}
                        </p>
                        <div className="space-y-1">
                          {sortedPayload.slice(0, 5).map((entry, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-secondary-foreground">
                                  {entry.dataKey}
                                </span>
                              </div>
                              <span className="font-bold text-white">
                                {(entry.value as number).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {sortedPayload.length > 5 && (
                            <p className="text-secondary-foreground text-xs">
                              +{sortedPayload.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {topAgentNames.map((agentName) => {
                const agent = topAgents.find((a) => a.name === agentName);
                const isLastPoint = (timestamp: string | undefined) => {
                  // Check if this is the last data point for this agent
                  if (!timestamp || !filteredData || filteredData.length === 0)
                    return false;
                  const currentIndex = filteredData.findIndex(
                    (d) => d.timestamp === timestamp,
                  );
                  return currentIndex === filteredData.length - 1;
                };

                return (
                  <Line
                    key={agentName}
                    type="monotone"
                    dataKey={agentName}
                    stroke={agentColorMap[agentName] || CHART_COLORS[0]}
                    strokeWidth={legendHoveredAgent === agentName ? 3 : 2}
                    dot={(props) => {
                      const payload = props.payload as { timestamp?: string };
                      const timestamp = payload?.timestamp;
                      if (
                        agent &&
                        isLastPoint(timestamp) &&
                        props.cx &&
                        props.cy
                      ) {
                        return (
                          <AgentAvatarDot
                            agent={agent}
                            cx={props.cx}
                            cy={props.cy}
                          />
                        );
                      }
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={3}
                          fill={props.stroke}
                        />
                      );
                    }}
                    connectNulls={true}
                    opacity={
                      legendHoveredAgent && legendHoveredAgent !== agentName
                        ? 0.3
                        : 1
                    }
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </HoverContext.Provider>
      </div>

      <div className="border-t-1 my-2 w-full"></div>
      <CustomLegend
        agents={topAgents}
        colorMap={agentColorMap}
        currentValues={latestValues}
        onAgentHover={handleLegendHover}
      />
    </>
  );
};
