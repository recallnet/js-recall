"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ActiveDotProps } from "recharts/types/util/types";

import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { RouterOutputs } from "@/rpc/router";
import { formatDate } from "@/utils/format";
import { formatDateShort } from "@/utils/format";

import { ChartSkeleton } from "./chart-skeleton";
import { CHART_COLORS, LIMIT_AGENTS_PER_CHART } from "./constants";
import { MetricTooltip } from "./custom-tooltip";

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

interface AgentAvatarDotProps extends ActiveDotProps {
  agent: RouterOutputs["competitions"]["getAgents"]["agents"][number];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  isHovered?: boolean;
}
/**
 * Agent avatar dot component for the timeline chart
 */
const AgentAvatarDot = ({
  agent,
  onMouseEnter,
  onMouseLeave,
  onClick,
  isHovered = false,
  ...props
}: AgentAvatarDotProps) => {
  // Use larger container size to accommodate hover scaling over agent avatar
  const containerSize = 44;
  const avatarSize = 32;
  const offset = containerSize / 2;

  return (
    <g>
      <foreignObject
        x={props.cx - offset}
        y={props.cy - offset}
        width={containerSize}
        height={containerSize}
      >
        <div
          className="flex h-full w-full cursor-pointer items-center justify-center"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <div
            className={cn(
              "transition-transform duration-200 ease-out",
              isHovered && "scale-130",
            )}
          >
            <AgentAvatar agent={agent} size={avatarSize} showHover={false} />
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

interface CustomDotProps extends ActiveDotProps {
  payload: {
    timestamp?: string;
  };
  value: number | null;
}

const CustomDot = ({
  cx,
  cy,
  stroke,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  stroke: string;
  opacity?: number;
}) => {
  return <circle cx={cx} cy={cy} r={3} fill={stroke} opacity={opacity} />;
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
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Handle line or agent avatar hover
  const handleLineOrAgentAvatarHover = useCallback(
    (agentName: string | null) => {
      // Don't show hover state if an agent is selected
      if (!selectedAgent) {
        setLineOrAgentAvatarHovered(agentName);
      }
    },
    [selectedAgent],
  );

  // Handle line or agent avatar leave
  const handleLineOrAgentAvatarLeave = useCallback(() => {
    if (!selectedAgent) {
      setLineOrAgentAvatarHovered(null);
    }
  }, [selectedAgent]);

  // Handle line click to toggle selection
  const handleLineClick = useCallback(
    (agentName: string, event?: React.MouseEvent) => {
      event?.stopPropagation();
      setSelectedAgent((prev) => (prev === agentName ? null : agentName));
      // Clear hover state when selecting
      setLineOrAgentAvatarHovered(null);
    },
    [],
  );

  // Global click handler to deselect when clicking outside the chart
  useEffect(() => {
    if (!selectedAgent) return;

    const handleGlobalClick = () => {
      setSelectedAgent(null);
    };

    // Add listener on next tick to avoid immediately clearing selection
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [selectedAgent]);

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
          // Only include finite numeric values; treat non-finite as null
          const numericValue =
            metricValue && Number.isFinite(metricValue) ? metricValue : null;
          dataPoint[agent.agentName] = numericValue;
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

  // Map of last valid (non-null, finite) timestamp per agent for avatar placement
  const lastValidTimestampByAgent = useMemo(() => {
    const lastMap: Record<string, string | null> = {};
    if (!filteredData || filteredData.length === 0) return lastMap;

    for (let i = filteredData.length - 1; i >= 0; i--) {
      const dataPoint = filteredData[i];
      if (!dataPoint) continue;

      Object.entries(dataPoint).forEach(([key, value]) => {
        if (key.includes("timestamp")) return;
        if (lastMap[key] !== undefined) return;
        if (typeof value === "number" && Number.isFinite(value)) {
          lastMap[key] = dataPoint.timestamp;
        } else if (lastMap[key] === undefined) {
          lastMap[key] = null;
        }
      });
    }

    return lastMap;
  }, [filteredData]);

  // Get all latest metric values
  const latestValues = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {};
    }

    const values: Record<string, number> = {};

    // Iterate through all data points from newest to oldest
    // For each agent, record their most recent non-null value
    for (let i = filteredData.length - 1; i >= 0; i--) {
      const dataPoint = filteredData[i];
      if (!dataPoint) continue;

      Object.entries(dataPoint).forEach(([key, value]) => {
        // Skip if already found a value for this agent, or if it's a timestamp field
        if (values[key] !== undefined || key.includes("timestamp")) return;

        if (typeof value === "number" && value !== null) {
          values[key] = value;
        }
      });
    }

    return values;
  }, [filteredData]);

  // Get top agents based on the metric value
  const topAgents = useMemo(() => {
    const agentsWithValues = agents
      .map((agent) => ({
        agent,
        value: latestValues[agent.name] ?? -Infinity,
      }))
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

  // Sort agent names so selected/hovered agent is rendered last (appears on top in SVG)
  const sortedAgentNames = useMemo(() => {
    // Priority: selectedAgent > hoveredAgent
    const activeAgent = selectedAgent ?? lineOrAgentAvatarHovered;
    if (!activeAgent) return topAgentNames;

    return [
      ...topAgentNames.filter((name) => name !== activeAgent),
      activeAgent,
    ];
  }, [topAgentNames, lineOrAgentAvatarHovered, selectedAgent]);

  if (isLoading) {
    return (
      <div className="h-150 w-full">
        <ChartSkeleton />
      </div>
    );
  }

  if (!timelineData || timelineData.length === 0 || status === "pending") {
    return (
      <div className="h-150 flex w-full flex-col items-center justify-center p-10">
        <span className="text-primary-foreground text-xl">
          {status === "pending"
            ? "Competition hasn't started yet"
            : "No data available"}
        </span>
        <span className="text-secondary-foreground text-md">
          {status === "pending" && startDate
            ? `The competition will start on ${formatDate(startDate)}.`
            : "Data will appear here as the competition progresses."}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="h-150 relative [&_svg:focus]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{ right: 30, bottom: 5, top: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="displayTimestamp"
              stroke="#9CA3AF"
              fontSize={12}
              type="category"
              interval="equidistantPreserveStart"
              tickMargin={10}
              minTickGap={20}
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tick={{ fill: "#9CA3AF" }}
              domain={[
                (dataMin: number) => dataMin * 0.95,
                (dataMax: number) => dataMax * 1.05,
              ]}
              tickFormatter={(value) =>
                yAxisType === "currency"
                  ? `$${(value / 1000).toFixed(1)}k`
                  : yAxisType === "percentage"
                    ? `${value.toFixed(2)}%`
                    : value.toFixed(2)
              }
            />
            <RechartsTooltip
              content={(props) => (
                <MetricTooltip
                  {...props}
                  yAxisType={yAxisType}
                  hoveredAgent={selectedAgent || lineOrAgentAvatarHovered}
                />
              )}
            />
            {sortedAgentNames.map((agentName) => {
              const agent = topAgents.find((a) => a.name === agentName);
              const isAgentsLastValidPoint = (
                agentKey: string,
                timestamp: string | undefined,
              ) => {
                if (!timestamp) return false;
                return lastValidTimestampByAgent[agentKey] === timestamp;
              };

              const activeAgent = selectedAgent || lineOrAgentAvatarHovered;
              const isActive = activeAgent === agentName;
              const isAnyActive = activeAgent !== null;

              return (
                <Line
                  className="cursor-pointer"
                  key={agentName}
                  type="monotone"
                  dataKey={agentName}
                  stroke={agentColorMap[agentName] ?? CHART_COLORS[0]}
                  strokeWidth={isActive ? 4 : 3}
                  connectNulls={true}
                  opacity={!isAnyActive || isActive ? 1 : 0.3}
                  isAnimationActive={false}
                  activeDot={false}
                  onClick={(e: unknown) => {
                    // Stop propagation to prevent outer div from clearing selection
                    if (e && typeof e === "object" && "stopPropagation" in e) {
                      (e as { stopPropagation: () => void }).stopPropagation();
                    }
                    handleLineClick(agentName);
                  }}
                  dot={(props: CustomDotProps) => {
                    const timestamp = props.payload?.timestamp;
                    const dotKey = `${agentName}-${timestamp || props.cx}-${props.cy}`;

                    // Determine if this point has a valid numeric value
                    const numericValue =
                      typeof props.value === "number" &&
                      Number.isFinite(props.value)
                        ? props.value
                        : null;

                    // Skip rendering dots for non-numeric or out-of-range values
                    if (numericValue === null) {
                      return <g key={dotKey} />;
                    }

                    if (agent && isAgentsLastValidPoint(agentName, timestamp)) {
                      // Only render avatar for last point
                      return (
                        <g key={dotKey}>
                          <AgentAvatarDot
                            agent={agent}
                            {...props}
                            onMouseEnter={() =>
                              handleLineOrAgentAvatarHover(agentName)
                            }
                            onMouseLeave={() => handleLineOrAgentAvatarLeave()}
                            onClick={() => handleLineClick(agentName)}
                            isHovered={
                              selectedAgent === agentName ||
                              (!selectedAgent &&
                                lineOrAgentAvatarHovered === agentName)
                            }
                          />
                        </g>
                      );
                    }
                    // Regular dot for all other points
                    const dotOpacity = !isAnyActive || isActive ? 1 : 0.3;

                    return (
                      <g key={dotKey}>
                        <CustomDot
                          cx={props.cx}
                          cy={props.cy}
                          stroke={agentColorMap[agentName] ?? CHART_COLORS[0]}
                          opacity={dotOpacity}
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
