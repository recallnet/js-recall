"use client";

import React, {useState, useMemo} from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from "recharts";
import {cn} from "@recallnet/ui2/lib/utils";
import {ChevronLeft, ChevronRight, Search} from "lucide-react";
import Image from "next/image";
import {Input} from "@recallnet/ui2/components/input";
import {Button} from "@recallnet/ui2/components/button";
import {useCompetitionPerformance} from "@/hooks/useCompetitionPerformance";
import {Agent, AgentCompetition} from "@/types";
import {formatDate} from "@/utils/format";

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

const CustomTooltip = ({active, payload, label}: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border-gray-600 rounded-[15px] p-3 shadow-lg">
        <span className="text-secondary-foreground text-sm">{formatDate(label)}</span>
        <div className="border-t my-2 w-full"></div>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{color: entry.color}} className="text-sm grid grid-cols-2 gap-3">
            <span className="truncate w-20">{entry.dataKey}</span> <span className="text-primary-foreground">${entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Legend Component
const CustomLegend = ({agents, colors, searchQuery, onSearchChange}: {
  agents: {name: string; imageUrl: string}[];
  colors: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) => {
  return (
    <div className="p-5">
      <div className="relative max-w-[500px] mb-4  text-secondary-foreground">
        <Input
          type="text"
          placeholder="Search for an agent..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className='w-full rounded-full'
        />
        <Search className="absolute right-5 bottom-3" size={16} />
      </div>
      <div className="flex flex-wrap gap-3">
        {agents.map((key, index) => (
          <div key={index} className="flex items-center w-50 gap-2 p-2 rounded-lg">
            <div
              className="w-8 h-8 rounded-full border-2 overflow-hidden flex-shrink-0"
              style={{borderColor: colors[index % colors.length]}}
            >
              <Image
                src={key.imageUrl || `/default_agent_2.png`}
                alt={key.name}
                width={15}
                height={15}
                className="w-full h-full"
              />
            </div>
            <span className="text-sm text-primary-foreground truncate">{key.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

type DateArr = {date: string}[]

const copyDateWithoutTimezone = (date: string) => {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

const fillMissingDays = (week: DateArr) => {
  const res = []

  let prev = 0
  for (const cur of week) {
    const cpy = copyDateWithoutTimezone(cur.date)
    const day = new Date(cpy)

    cpy.setDate(cpy.getDate() - (cpy.getDay() - prev))
    while (day.getDay() > cpy.getDay()) {
      res.push({date: new Date(cpy)})
      cpy.setDate(cpy.getDate() + 1)
    }


    res.push(cur)
    prev = day.getDay() + 1
  }

  const cur = copyDateWithoutTimezone(res[res.length - 1]?.date as string)
  while (cur.getDay() < 6) {
    cur.setDate(cur.getDate() + 1)
    res.push({date: new Date(cur)})
  }

  return res
}

const datesByWeek = (dates: DateArr) => {
  if (dates.length === 0) return [];

  const weekMap = new Map<string, DateArr>();

  dates.forEach(date => {
    const currentDate = new Date(date.date);

    // Get the start of the week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Use the start of week as the key
    const weekKey = startOfWeek.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }

    weekMap.get(weekKey)!.push(date);
  });

  const final = Array.from(weekMap.entries())
    .map(([, weekDates]) => fillMissingDays(weekDates));

  return final
};

interface PortfolioChartProps {
  competitionId?: string;
  agents?: (Agent | AgentCompetition)[]
}

type PerformanceViewRecord = Record<string, {agent: string, amount: number}[]>

export const PerformanceChart: React.FC<PortfolioChartProps> = ({competitionId, agents}) => {
  const {data: performanceRaw, isLoading} = useCompetitionPerformance(competitionId)
  const [dateRangeIndex, setDateRangeIndex] = useState(0); // Default to May-22 to May-24
  const [searchQuery, setSearchQuery] = useState("");

  const parsedData = useMemo(() => {
    if (!performanceRaw)
      return []

    const dateMap: PerformanceViewRecord = performanceRaw.reduce((acc, cur) => {
      const curMap: PerformanceViewRecord = cur.timeline.reduce((cacc, ccur) => {
        const nxt = {agent: cur.agentName, amount: ccur.totalValue}
        const current = cacc[ccur.date as keyof typeof cacc]
        return ({
          ...cacc,
          [ccur.date]: current ? [...current, nxt] : [nxt]
        })
      }, {})

      for (const dateEntry of Object.keys(curMap)) {
        if (acc[dateEntry]) {
          const a = acc[dateEntry] as {agent: string; amount: number}[]
          const b = curMap[dateEntry] as {agent: string; amount: number}[]
          acc[dateEntry] = [...a, ...b]
        } else {
          acc[dateEntry] = curMap[dateEntry] as {agent: string; amount: number}[]
        }
      }

      return acc
    }, {} as PerformanceViewRecord)

    const dateArr = Object.entries(dateMap)
    const sortedAndTransformed = dateArr.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(entry => {
      const points = entry[1].reduce((acc, cur) => ({
        ...acc,
        [cur.agent]: cur.amount
      }), {})

      return ({date: entry[0], ...points})
    })

    return datesByWeek(sortedAndTransformed)
  }, [performanceRaw])

  const filteredData = useMemo(() => {
    return (parsedData[dateRangeIndex] || []).map(data => ({...data, date: formatDate(data.date)}))
  }, [parsedData, dateRangeIndex]);

  const filteredDataKeys = useMemo(() => {
    const res: Record<string, number> = filteredData.reduce((acc, cur) =>
    ({
      ...acc, ...cur
    }), {});

    if (res.date)
      delete res?.date;

    return Object.keys(res).filter(agent => agent.startsWith(searchQuery))
  }, [filteredData, searchQuery]);

  const agentsWithData = useMemo(() => {
    return agents?.filter(agent => filteredDataKeys.some(agentName => agentName == agent.name)) || []
  }, [agents, filteredDataKeys])

  const handlePrevRange = () => {
    setDateRangeIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextRange = () => {
    setDateRangeIndex(prev => Math.min(parsedData.length - 1, prev + 1));
  };

  return (
    <div className={cn("w-full")}>
      <div className="rounded-lg border">
        <div className="mb-2 bg-card w-full p-5">
          <h2 className="text-2xl font-bold text-white mb-2">Portfolio Performance</h2>
          <p className="text-gray-400">Real-time trading performance of AI competitors</p>
        </div>
        <div className="flex justify-end w-full items-center px-6 py-4">
          <div className="flex gap-1 items-center text-secondary-foreground text-sm">
            <Button
              onClick={handlePrevRange}
              disabled={dateRangeIndex <= 0}
              variant='outline'
              className="border-none hover:bg-black hover:text-primary-foreground p-0"
            >
              <ChevronLeft strokeWidth={1.5} />
            </Button>
            <span className="w-22">{filteredData[0]?.date as string}</span>
            <div className="rigin-center rotate-30 mx-2 h-4 w-[1px] bg-gray-200"></div>
            <span className="w-22">{filteredData[filteredData.length - 1]?.date as string}</span>
            <Button
              onClick={handleNextRange}
              disabled={dateRangeIndex >= parsedData.length - 1}
              variant='outline'
              className="border-none hover:bg-black hover:text-primary-foreground p-0"
            >
              <ChevronRight strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        <div className="h-120">
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
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
                type="category"
                ticks={filteredData.map(({date}) => date)} // Array of all dates you want to show
                interval={0} // Show all ticks
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                domain={['dataMin - 100', 'dataMax + 100']}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              {filteredDataKeys.map((key, index: number) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  connectNulls={true}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{fill: colors[index % colors.length], strokeWidth: 2, r: 4}}
                  activeDot={{r: 6, stroke: colors[index % colors.length], strokeWidth: 2}}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

        </div>
        <div className="border-t-1 w-full my-2"></div>
        <CustomLegend
          agents={agentsWithData as {name: string, imageUrl: string}[]}
          colors={colors}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
};
