"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import React, { memo, useEffect, useMemo, useState } from "react";
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
import {
  Agent,
  AgentCompetition,
  Competition,
  CompetitionStatus,
} from "@/types";
import { formatDate } from "@/utils/format";

import { ShareModal } from "../share-modal";

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

    return (
      <div className="bg-card z-50 rounded-[15px] border-gray-600 p-3 shadow-lg">
        <span className="text-secondary-foreground text-sm">{label}</span>
        <div className="my-2 w-full border-t"></div>
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey}-${index}`}
            style={{ color: entry.color }}
            className="flex items-center gap-2 text-sm"
          >
            <span className="min-w-[160px] truncate">{entry.dataKey}</span>
            <span className="text-primary-foreground whitespace-nowrap">
              $
              {entry.value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ))}
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

// Custom Legend Component
const CustomLegend = ({
  agents,
  colors,
  searchQuery,
  onSearchChange,
}: {
  agents: { name: string; imageUrl: string }[];
  colors: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) => {
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
        {agents.map((agent, index) => (
          <div
            key={agent.name}
            className="w-50 flex items-center gap-2 rounded-lg p-2"
          >
            <div
              className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border-2"
              style={{ borderColor: colors[index % colors.length] }}
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
        ))}
      </div>
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
  agents?: (Agent | AgentCompetition)[];
  className?: string;
}

type TimelineViewRecord = Record<string, { agent: string; amount: number }[]>;

// Memoized chart wrapper to prevent axis flickering
const ChartWrapper = memo(
  ({
    filteredData,
    filteredDataKeys,
    colors,
    shouldAnimate,
    isFullRange,
  }: {
    filteredData: Array<Record<string, string | number>>;
    filteredDataKeys: string[];
    colors: string[];
    shouldAnimate: boolean;
    isFullRange?: boolean;
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
              // For duplicate dates, only show the first occurrence
              const firstOccurrence = filteredData.findIndex(
                (d) => d.timestamp === value,
              );
              if (firstOccurrence !== index) {
                return "";
              }

              // For full range, limit the number of ticks shown
              if (isFullRange) {
                const uniqueValues = [
                  ...new Set(filteredData.map((d) => d.timestamp)),
                ];
                const uniqueIndex = uniqueValues.indexOf(value);
                // Show first, last, and evenly distributed dates
                const step = Math.ceil(uniqueValues.length / 8);
                if (
                  uniqueIndex === 0 ||
                  uniqueIndex === uniqueValues.length - 1 ||
                  uniqueIndex % step === 0
                ) {
                  return value;
                }
                return "";
              }

              return value;
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
            colors={colors}
            isAnimationActive={shouldAnimate}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  },
);
ChartWrapper.displayName = "ChartWrapper";

// Memoized chart lines component to prevent unnecessary re-renders
const ChartLines = memo(
  ({
    dataKeys,
    colors,
    isAnimationActive,
  }: {
    dataKeys: string[];
    colors: string[];
    isAnimationActive: boolean;
  }) => {
    return (
      <>
        {dataKeys.map((key, index: number) => (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            connectNulls={true}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            isAnimationActive={isAnimationActive}
            animationDuration={1000}
            dot={{
              fill: colors[index % colors.length],
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              r: 6,
              stroke: colors[index % colors.length],
              strokeWidth: 2,
            }}
          />
        ))}
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
      return allData.map((data) => ({
        ...data,
        timestamp: formatDate(data.timestamp),
      }));
    }

    // For other statuses, show week by week
    return (parsedData[dateRangeIndex] || []).map((data) => ({
      ...data,
      timestamp: formatDate(data.timestamp),
    }));
  }, [parsedData, dateRangeIndex, competition.status]);

  const filteredDataKeys = useMemo(() => {
    const res: Record<string, number> = filteredData.reduce(
      (acc, cur) => ({
        ...acc,
        ...cur,
      }),
      {},
    );

    if (res.timestamp) delete res?.timestamp;

    return Object.keys(res).filter((agent) =>
      agent.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
    );
  }, [filteredData, debouncedSearchQuery]);

  const agentsWithData = useMemo(() => {
    return (
      agents?.filter((agent) =>
        filteredDataKeys.some((agentName) => agentName == agent.name),
      ) || []
    );
  }, [agents, filteredDataKeys]);

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
                  {filteredData[0]?.timestamp as string}
                </span>
                <div className="rigin-center rotate-30 mx-2 h-4 w-[1px] bg-gray-200"></div>
                <span className="w-22">
                  {filteredData[filteredData.length - 1]?.timestamp as string}
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
            <ChartWrapper
              filteredData={filteredData}
              filteredDataKeys={filteredDataKeys}
              colors={colors}
              shouldAnimate={shouldAnimate}
              isFullRange={competition.status === CompetitionStatus.Ended}
            />
          </div>
          <div className="border-t-1 my-2 w-full"></div>
          <CustomLegend
            agents={agentsWithData as { name: string; imageUrl: string }[]}
            colors={colors}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </>
      )}
    </div>
  );
};
