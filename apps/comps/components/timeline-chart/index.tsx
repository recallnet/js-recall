"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Input } from "@recallnet/ui2/components/input";
import { cn } from "@recallnet/ui2/lib/utils";

import { useCompetitionTimeline } from "@/hooks/useCompetitionTimeline";
import { AgentCompetition, Competition, CompetitionStatus } from "@/types";
import { formatDate } from "@/utils/format";

import { Pagination } from "../pagination";
import { ShareModal } from "../share-modal";

/**
 * Format date to "Month dayth" style (e.g., "Jun 1st", "May 23rd")
 */
const formatDateShort = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();

  // Add ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return `${month} ${day}${getOrdinalSuffix(day)}`;
};

const colors = [
  "#FF6B35", // Orange
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Light Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light Yellow
];

const LIMIT_AGENTS_PER_PAGE = 10;

// Context for hover state to avoid prop drilling and chart re-renders
const HoverContext = createContext<{
  hoveredAgent: string | null;
  setHoveredAgent: (agent: string | null) => void;
}>({
  hoveredAgent: null,
  setHoveredAgent: () => {},
});

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    color: string;
    dataKey: string;
    value: number;
    [key: string]: unknown;
  }>;
  label?: string | number;
}

// Inner component that renders the tooltip content
const TooltipContent = memo(
  ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    // Filter out timestamp-related entries and sort by value desc
    const timestampKeys = [
      "timestamp",
      "originalTimestamp",
      "displayTimestamp",
    ];
    const filteredPayload = payload.filter(
      (entry) => !timestampKeys.includes(entry.dataKey as string),
    );
    const sorted = [...filteredPayload].sort(
      (a, b) => (b.value ?? 0) - (a.value ?? 0),
    );

    // Limit to 25 agents maximum
    const MAX_TOOLTIP_AGENTS = 25;
    const visibleEntries = sorted.slice(0, MAX_TOOLTIP_AGENTS);
    const hiddenCount = sorted.length - MAX_TOOLTIP_AGENTS;

    return (
      <div className="bg-card z-50 max-w-[320px] rounded-[15px] border-gray-600 p-3 shadow-lg">
        <span className="text-secondary-foreground text-sm">{label}</span>
        <div className="my-2 w-full border-t"></div>
        {visibleEntries.map((entry, index) => (
          <div
            key={`${entry.dataKey}-${index}`}
            style={{ color: entry.color }}
            className="flex items-center gap-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{entry.dataKey}</span>
            <span className="text-primary-foreground ml-auto whitespace-nowrap pl-2">
              $
              {entry.value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="text-secondary-foreground mt-2 border-t border-gray-600 pt-2 text-xs">
            ...plus {hiddenCount} more agent{hiddenCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    return (
      prevProps.active === nextProps.active &&
      prevProps.label === nextProps.label &&
      JSON.stringify(prevProps.payload) === JSON.stringify(nextProps.payload)
    );
  },
);
TooltipContent.displayName = "TooltipContent";

// Wrapper component that Recharts can properly instantiate
const CustomTooltip = (props: TooltipProps) => {
  return <TooltipContent {...props} />;
};

interface CustomLegendProps {
  agents: { name: string; imageUrl: string }[];
  colorMap: Record<string, string>;
  currentValues?: Record<string, number>;
  currentOrder?: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAgentHover?: (agentName: string | null) => void;
}

// Custom Legend Component
const CustomLegend = ({
  agents,
  colorMap,
  currentValues,
  currentOrder,
  searchQuery,
  onSearchChange,
  onAgentHover,
}: CustomLegendProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  // Sort agents by the exact order from the current hover payload, if available.
  // Fallback to sorting by value desc, then by name for stability.
  const sortedAgents = useMemo(() => {
    if (currentOrder && currentOrder.length > 0) {
      const orderIndex: Record<string, number> = {};
      currentOrder.forEach((name, idx) => {
        orderIndex[name] = idx;
      });
      return [...agents].sort((a, b) => {
        const ai = orderIndex[a.name] ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndex[b.name] ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        // tie-breaker using value desc if available, otherwise alpha
        const va = currentValues?.[a.name] ?? -Infinity;
        const vb = currentValues?.[b.name] ?? -Infinity;
        if (va !== vb) return vb - va;
        return a.name.localeCompare(b.name);
      });
    }

    if (currentValues && Object.keys(currentValues).length > 0) {
      return [...agents].sort((a, b) => {
        const va = currentValues[a.name] ?? -Infinity;
        const vb = currentValues[b.name] ?? -Infinity;
        if (va !== vb) return vb - va;
        return a.name.localeCompare(b.name);
      });
    }

    return agents;
  }, [agents, currentOrder, currentValues]);

  // Calculate paginated agents
  const paginatedAgents = useMemo(() => {
    const startIndex = (currentPage - 1) * LIMIT_AGENTS_PER_PAGE;
    const endIndex = startIndex + LIMIT_AGENTS_PER_PAGE;
    return sortedAgents.slice(startIndex, endIndex);
  }, [sortedAgents, currentPage]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-5">
      <div className="text-secondary-foreground relative mb-4 max-w-[500px]">
        <Input
          type="text"
          placeholder="Search for an agent..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-full"
        />
        <Search className="absolute bottom-3 right-5" size={16} />
      </div>

      <div className="flex flex-wrap gap-3">
        {paginatedAgents.map((agent) => {
          return (
            <div
              key={agent.name}
              className="w-50 flex cursor-default items-center gap-2 rounded-lg p-2 transition-all duration-200 hover:scale-105 hover:bg-gray-800/50"
              onMouseEnter={() => onAgentHover?.(agent.name)}
              onMouseLeave={() => onAgentHover?.(null)}
            >
              <div
                className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border-2"
                style={{ borderColor: colorMap[agent.name] || colors[0] }}
              >
                <Image
                  src={agent.imageUrl || `/default_agent_2.png`}
                  alt={agent.name}
                  width={15}
                  height={15}
                  className="h-full w-full"
                />
              </div>
              <span className="text-primary-foreground truncate text-sm">
                {agent.name}
              </span>
            </div>
          );
        })}
      </div>

      <Pagination
        totalItems={agents.length}
        currentPage={currentPage}
        itemsPerPage={LIMIT_AGENTS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

type DateArr = { timestamp: string }[];

const copyDateWithoutTimezone = (timestamp: string) => {
  const [year, month, day] = timestamp.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day);
};

const fillMissingDays = (week: DateArr) => {
  const res = [];

  let prev = 0;
  for (const cur of week) {
    const cpy = copyDateWithoutTimezone(cur.timestamp);
    const day = new Date(cpy);

    cpy.setDate(cpy.getDate() - (cpy.getDay() - prev));
    while (day.getDay() > cpy.getDay()) {
      res.push({ timestamp: new Date(cpy) });
      cpy.setDate(cpy.getDate() + 1);
    }

    res.push(cur);
    prev = day.getDay() + 1;
  }

  const cur = copyDateWithoutTimezone(res[res.length - 1]?.timestamp as string);
  while (cur.getDay() < 6) {
    cur.setDate(cur.getDate() + 1);
    res.push({ timestamp: new Date(cur) });
  }

  return res;
};

const datesByWeek = (dates: DateArr) => {
  if (dates.length === 0) return [];

  const weekMap = new Map<string, DateArr>();

  dates.forEach((timestamp) => {
    const currentDate = new Date(timestamp.timestamp);

    // Get the start of the week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Use the start of week as the key
    const weekKey = startOfWeek.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }

    weekMap.get(weekKey)!.push(timestamp);
  });

  const final = Array.from(weekMap.entries()).map(([, weekDates]) =>
    fillMissingDays(weekDates),
  );

  return final;
};

interface PortfolioChartProps {
  competition: Competition;
  agents?: AgentCompetition[]; // Only used as fallback, real agent data comes from timelineRaw
  className?: string;
}

type TimelineViewRecord = Record<string, { agent: string; amount: number }[]>;

// Memoized chart wrapper to prevent axis flickering
const ChartWrapper = memo(
  ({
    filteredData,
    filteredDataKeys,
    agentColorMap,
    shouldAnimate,
    isFullRange,
    onHoverChange,
  }: {
    filteredData: Array<Record<string, string | number>>;
    filteredDataKeys: string[];
    agentColorMap: Record<string, string>;
    shouldAnimate: boolean;
    isFullRange?: boolean;
    onHoverChange?: (
      data: Record<string, number> | null,
      order?: string[],
    ) => void;
  }) => {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={filteredData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          onMouseLeave={() => onHoverChange && onHoverChange(null, [])}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            fontSize={12}
            type="category"
            interval={isFullRange ? "preserveEnd" : 0}
            tick={{ fontSize: 12 }}
            tickFormatter={(value, index) => {
              // For active competitions, format the original timestamp
              if (!isFullRange) {
                // Only show labels at reasonable intervals to prevent overcrowding
                const totalPoints = filteredData.length;
                const maxLabels = 8; // Maximum number of labels to show
                const step = Math.max(1, Math.ceil(totalPoints / maxLabels));

                // Always show first and last, plus evenly spaced labels
                if (
                  index === 0 ||
                  index === totalPoints - 1 ||
                  index % step === 0
                ) {
                  const dataPoint = filteredData[index];
                  if (dataPoint && dataPoint.originalTimestamp) {
                    return formatDateShort(
                      dataPoint.originalTimestamp as string,
                    );
                  }
                  return formatDateShort(value as string);
                }
                return "";
              }

              // For ended competitions (full range), handle different granularities
              const dataPoint = filteredData[index];

              // If we have originalTimestamp, this is a high-granularity short competition
              if (dataPoint && dataPoint.originalTimestamp) {
                const date = new Date(dataPoint.originalTimestamp);
                // For high granularity, show time more frequently
                const totalPoints = filteredData.length;
                const step = Math.max(1, Math.ceil(totalPoints / 10)); // Show ~10 labels max

                if (
                  index % step === 0 ||
                  index === 0 ||
                  index === totalPoints - 1
                ) {
                  return date.toLocaleTimeString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                }
                return "";
              }

              // For daily granularity competitions, use existing logic
              const firstOccurrence = filteredData.findIndex(
                (d) => d.timestamp === value,
              );
              if (firstOccurrence !== index) {
                return "";
              }

              const uniqueValues = [
                ...new Set(filteredData.map((d) => d.timestamp)),
              ];
              const uniqueIndex = uniqueValues.indexOf(value);
              const step = Math.ceil(uniqueValues.length / 8);
              if (
                uniqueIndex === 0 ||
                uniqueIndex === uniqueValues.length - 1 ||
                uniqueIndex % step === 0
              ) {
                return value;
              }
              return "";
            }}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            domain={["dataMin - 100", "dataMax + 100"]}
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            content={CustomTooltip}
            cursor={{
              stroke: "#9CA3AF",
              strokeWidth: 1,
              strokeDasharray: "5 5",
            }}
            wrapperStyle={{ zIndex: 10000 }}
          />
          <ChartLines
            dataKeys={filteredDataKeys}
            colorMap={agentColorMap}
            isAnimationActive={shouldAnimate}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    // Prevent chart structure re-render - hover is handled via context
    // Notably, this prevents the x-axis from flickering when hovering over the legend
    return (
      prevProps.filteredData === nextProps.filteredData &&
      prevProps.filteredDataKeys === nextProps.filteredDataKeys &&
      prevProps.agentColorMap === nextProps.agentColorMap &&
      prevProps.shouldAnimate === nextProps.shouldAnimate &&
      prevProps.isFullRange === nextProps.isFullRange &&
      prevProps.onHoverChange === nextProps.onHoverChange
    );
  },
);
ChartWrapper.displayName = "ChartWrapper";

// Memoized chart lines component to prevent unnecessary re-renders
const ChartLines = memo(
  ({
    dataKeys,
    colorMap,
    isAnimationActive,
  }: {
    dataKeys: string[];
    colorMap: Record<string, string>;
    isAnimationActive: boolean;
  }) => {
    const { hoveredAgent } = useContext(HoverContext);
    return (
      <>
        {dataKeys.map((key) => {
          const isHovered = hoveredAgent === key;
          const isOtherHovered = hoveredAgent && hoveredAgent !== key;

          return (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              connectNulls={true}
              stroke={colorMap[key]}
              strokeWidth={isHovered ? 3 : 2}
              strokeOpacity={isOtherHovered ? 0.3 : 1}
              isAnimationActive={isAnimationActive}
              animationDuration={1000}
              dot={{
                fill: colorMap[key],
                strokeWidth: 2,
                r: isHovered ? 5 : 4,
                fillOpacity: isOtherHovered ? 0.3 : 1,
              }}
              activeDot={{
                r: isHovered ? 7 : 6,
                stroke: colorMap[key],
                strokeWidth: 2,
                strokeOpacity: isOtherHovered ? 0.3 : 1,
                fillOpacity: isOtherHovered ? 0.3 : 1,
              }}
            />
          );
        })}
      </>
    );
  },
);
ChartLines.displayName = "ChartLines";

export const TimelineChart: React.FC<PortfolioChartProps> = ({
  competition,
  agents,
  className,
}) => {
  const { data: timelineRaw, isLoading } = useCompetitionTimeline(
    competition.id,
    competition.status,
  );
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [shouldAnimate, setShouldAnimate] = useState(true);
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

  // Disable animation after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldAnimate(false);
    }, 1500); // Allow animation to complete on initial render

    return () => clearTimeout(timer);
  }, []);

  // Intelligent date range selection based on competition status and dates
  useEffect(() => {
    if (!parsedData.length) return;

    const now = new Date();
    const endDate = competition.endDate ? new Date(competition.endDate) : null;

    let targetIndex = parsedData.length - 1; // Default to most recent week

    if (competition.status === CompetitionStatus.Active) {
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
    } else if (competition.status === CompetitionStatus.Ended) {
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
  }, [
    parsedData,
    competition.status,
    competition.startDate,
    competition.endDate,
  ]);

  const filteredData = useMemo(() => {
    // For ended competitions, show all data in a single view
    if (
      competition.status === CompetitionStatus.Ended &&
      parsedData.length > 0
    ) {
      // Flatten all weeks into a single array
      const allData = parsedData.flat();

      // Calculate competition duration to determine granularity
      const startDate = competition.startDate
        ? new Date(competition.startDate)
        : null;
      const endDate = competition.endDate
        ? new Date(competition.endDate)
        : null;
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
  }, [
    parsedData,
    dateRangeIndex,
    competition.status,
    competition.startDate,
    competition.endDate,
  ]);

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

  // Filter data keys based on search
  const filteredDataKeys = useMemo(() => {
    return allDataKeys.filter((agent) =>
      agent.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
    );
  }, [allDataKeys, debouncedSearchQuery]);

  // Extract all agents from timeline data
  const allAgentsFromTimeline = useMemo(() => {
    if (!timelineRaw) return [];

    const agentMap = new Map<string, { name: string; imageUrl: string }>();

    timelineRaw.forEach((agentData) => {
      agentMap.set(agentData.agentName, {
        name: agentData.agentName,
        imageUrl: `/default_agent_2.png`, // Timeline data doesn't include imageUrl
      });
    });

    return Array.from(agentMap.values());
  }, [timelineRaw]);

  // All agents with data (for color mapping - unfiltered)
  // Prefer agents from timeline data, fallback to agents prop
  const allAgentsWithData = useMemo(() => {
    const timelineAgents = allAgentsFromTimeline.filter((agent) =>
      allDataKeys.some((agentName) => agentName === agent.name),
    );

    if (timelineAgents.length > 0) {
      return timelineAgents;
    }

    // Fallback to agents prop if timeline data doesn't have agent info
    return (
      agents?.filter((agent) =>
        allDataKeys.some((agentName) => agentName === agent.name),
      ) || []
    );
  }, [allAgentsFromTimeline, allDataKeys, agents]);

  // Filtered agents for the legend (based on search query)
  const filteredAgentsForLegend = useMemo(() => {
    return allAgentsWithData.filter((agent) =>
      filteredDataKeys.includes(agent.name),
    );
  }, [allAgentsWithData, filteredDataKeys]);

  // Create a consistent color mapping for all agents
  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    allDataKeys.forEach((agentName, index) => {
      map[agentName] = colors[index % colors.length]!;
    });
    return map;
  }, [allDataKeys]);

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

  return (
    <div className={cn("w-full rounded-lg border", className)}>
      <div className="bg-card flex items-center justify-between p-5">
        <div className="w-full">
          <h2
            id="portfolio-timeline"
            className="mb-2 text-2xl font-bold text-white"
          >
            Portfolio Timeline
          </h2>
          <p className="text-gray-400">
            Real-time trading timeline of AI competitors
          </p>
        </div>
        <ShareModal
          title="Share portfolio timeline"
          url={`https://app.recall.network/competitions/${competition.id}#portfolio-timeline`}
          size={20}
        />
      </div>
      {(timelineRaw && timelineRaw?.length <= 0) ||
      isLoading ||
      competition.status === CompetitionStatus.Pending ? (
        <div className="h-30 flex w-full flex-col items-center justify-center p-10">
          <span className="text-primary-foreground">
            {competition.status === CompetitionStatus.Pending
              ? "Competition hasn&apos;t started yet"
              : "No agents competing yet"}
          </span>
          <span className="text-secondary-foreground text-sm">
            {competition.status === CompetitionStatus.Pending &&
            competition.startDate
              ? `The competition will start on ${formatDate(
                  competition.startDate,
                )}.`
              : "Agents will appear here as soon as the competition starts."}
          </span>
        </div>
      ) : (
        <>
          {competition.status !== CompetitionStatus.Ended && (
            <div className="flex w-full items-center justify-end px-6 py-4">
              <div className="text-secondary-foreground flex items-center gap-1 text-sm">
                <Button
                  onClick={handlePrevRange}
                  disabled={dateRangeIndex <= 0}
                  variant="outline"
                  className="hover:text-primary-foreground border-none p-0 hover:bg-black"
                >
                  <ChevronLeft strokeWidth={1.5} />
                </Button>
                <span className="w-22">
                  {filteredData[0]?.originalTimestamp
                    ? formatDateShort(filteredData[0].originalTimestamp)
                    : formatDateShort(filteredData[0]?.timestamp as string)}
                </span>
                <div className="rigin-center rotate-30 mx-2 h-4 w-[1px] bg-gray-200"></div>
                <span className="w-22">
                  {(() => {
                    const lastItem = filteredData[filteredData.length - 1];
                    return lastItem?.originalTimestamp
                      ? formatDateShort(lastItem.originalTimestamp)
                      : formatDateShort(lastItem?.timestamp as string);
                  })()}
                </span>
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
                isFullRange={competition.status === CompetitionStatus.Ended}
                onHoverChange={handleHoverChange}
              />
            </HoverContext.Provider>
          </div>
          <div className="border-t-1 my-2 w-full"></div>
          <CustomLegend
            agents={
              filteredAgentsForLegend as { name: string; imageUrl: string }[]
            }
            colorMap={agentColorMap}
            currentValues={hoveredDataPoint || latestValues}
            currentOrder={hoveredOrder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAgentHover={handleLegendHover}
          />
        </>
      )}
    </div>
  );
};
