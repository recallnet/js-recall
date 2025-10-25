"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AgentAvatar } from "@/components/agent-avatar";
import { RouterOutputs } from "@/rpc/router";
import { formatDate } from "@/utils/format";

import { ChartSkeleton } from "./chart-skeleton";
import { CHART_COLORS, LIMIT_AGENTS_PER_CHART } from "./constants";
import { MetricTooltip } from "./custom-tooltip";
import { formatDateShort } from "./utils";

interface MetricTimelineChartProps {
  timelineData: RouterOutputs["competitions"]["getTimeline"];
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
  metric:
    | "calmarRatio"
    | "sortinoRatio"
    | "simpleReturn"
    | "annualizedReturn"
    | "maxDrawdown"
    | "totalValue";
  yAxisType?: "currency" | "percentage" | "number";
  isLoading?: boolean;
  status: "pending" | "active" | "ending" | "ended";
  startDate?: Date | null;
  dateRange?: "all" | "72h";
}

interface AgentAvatarDotProps {
  agent: RouterOutputs["competitions"]["getAgents"]["agents"][number];
  cx: number;
  cy: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Agent avatar dot component for the timeline chart
 */
const AgentAvatarDot = ({
  agent,
  cx,
  cy,
  onMouseEnter,
  onMouseLeave,
}: AgentAvatarDotProps) => {
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
          className="flex h-full w-full items-center justify-center"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <AgentAvatar agent={agent} size={avatarSize} showHover={false} />
        </div>
      </foreignObject>
    </g>
  );
};

const CustomDot = ({
  cx,
  cy,
  stroke,
}: {
  cx: number;
  cy: number;
  stroke: string;
}) => {
  return <circle cx={cx} cy={cy} r={3} fill={stroke} />;
};

/**
 * Generic metric timeline chart component that displays progression of a specific metric over time
 */
export const MetricTimelineChart: React.FC<MetricTimelineChartProps> = ({
  timelineData,
  agents,
  metric,
  yAxisType = "number",
  isLoading = false,
  status,
  startDate,
  dateRange = "all",
}) => {
  const [lineOrAgentAvatarHovered, setLineOrAgentAvatarHovered] = useState<
    string | null
  >(null);

  // Handle line or agent avatar hover
  const handleLineOrAgentAvatarHover = useCallback(
    (agentName: string | null) => {
      setLineOrAgentAvatarHovered(agentName);
    },
    [],
  );

  // Handle line or agent avatar leave
  const handleLineOrAgentAvatarLeave = useCallback(() => {
    setLineOrAgentAvatarHovered(null);
  }, []);

  // Parse timeline data for the specific metric and filter based on date range
  const filteredData = useMemo(() => {
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

    // Filter timestamps based on date range
    let timestampsToShow = sortedTimestamps;
    if (dateRange === "72h" && sortedTimestamps.length > 0) {
      const now = new Date();
      const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      timestampsToShow = sortedTimestamps.filter(
        (timestamp) => new Date(timestamp) >= seventyTwoHoursAgo,
      );
    }

    const result: Array<{
      timestamp: string;
      [key: string]: string | number | null;
    }> = timestampsToShow.map((timestamp) => {
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

    return result.map((data) => ({
      ...data,
      originalTimestamp: data.timestamp,
      displayTimestamp: formatDateShort(data.timestamp, true),
    }));
  }, [timelineData, metric, dateRange]);

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

  // Sort agent names so hovered agent is rendered last (appears on top in SVG)
  const sortedAgentNames = useMemo(() => {
    if (!lineOrAgentAvatarHovered) return topAgentNames;

    return [
      ...topAgentNames.filter((name) => name !== lineOrAgentAvatarHovered),
      lineOrAgentAvatarHovered,
    ];
  }, [topAgentNames, lineOrAgentAvatarHovered]);

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
      <div className="h-120 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{ right: 30, bottom: 60, top: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="displayTimestamp"
              stroke="#9CA3AF"
              fontSize={12}
              type="category"
              interval={status === "ended" ? "preserveEnd" : 0}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              angle={-45}
              textAnchor="end"
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tick={{ fill: "#9CA3AF" }}
              tickFormatter={(value) =>
                yAxisType === "currency"
                  ? `$${(value / 1000).toFixed(1)}k`
                  : yAxisType === "percentage"
                    ? `${value.toFixed(2)}%`
                    : value.toFixed(2)
              }
            />
            <Tooltip
              content={(props) => (
                <MetricTooltip
                  {...props}
                  yAxisType={yAxisType}
                  hoveredAgent={lineOrAgentAvatarHovered}
                />
              )}
            />
            {sortedAgentNames.map((agentName) => {
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
                  className="cursor-pointer"
                  key={agentName}
                  type="monotone"
                  dataKey={agentName}
                  stroke={agentColorMap[agentName] ?? CHART_COLORS[0]}
                  strokeWidth={lineOrAgentAvatarHovered === agentName ? 4 : 3}
                  connectNulls={true}
                  opacity={
                    lineOrAgentAvatarHovered === null ||
                    lineOrAgentAvatarHovered === agentName
                      ? 1
                      : 0.3
                  }
                  isAnimationActive={false}
                  activeDot={false}
                  dot={(props) => {
                    const timestamp = (props.payload as { timestamp?: string })
                      ?.timestamp;
                    const dotKey = `${agentName}-${timestamp || props.cx}-${props.cy}`;

                    if (agent && isLastPoint(timestamp)) {
                      // Only render avatar for last point
                      return (
                        <g key={dotKey}>
                          <AgentAvatarDot
                            agent={agent}
                            cx={props.cx}
                            cy={props.cy}
                            onMouseEnter={() =>
                              handleLineOrAgentAvatarHover(agentName)
                            }
                            onMouseLeave={() => handleLineOrAgentAvatarLeave()}
                          />
                        </g>
                      );
                    }
                    // Regular dot for all other points
                    return (
                      <g key={dotKey}>
                        <CustomDot
                          cx={props.cx}
                          cy={props.cy}
                          stroke={agentColorMap[agentName] ?? CHART_COLORS[0]}
                        />
                      </g>
                    );
                  }}
                  onMouseEnter={() => handleLineOrAgentAvatarHover(agentName)}
                  onMouseLeave={() => handleLineOrAgentAvatarLeave()}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};
