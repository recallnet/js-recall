"use client";

import React, {useState, useMemo} from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from "recharts";
import {Tabs, TabsList, TabsTrigger} from "@recallnet/ui2/components/tabs";
import {cn} from "@recallnet/ui2/lib/utils";
import {Search} from "lucide-react";
import Image from "next/image";
import {Input} from "@recallnet/ui2/components/input";
import {useCompetitionPerformance} from "@/hooks/useCompetitionPerformance";
import {Agent, AgentCompetition} from "@/types";

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

// Available date ranges
const dateRanges = [
  {start: "May-20", end: "May-22"},
  {start: "May-22", end: "May-24"},
  {start: "May-24", end: "May-26"},
  {start: "May-26", end: "May-28"},
  {start: "May-28", end: "May-30"},
];


const CustomTooltip = ({active, payload, label}: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-white font-semibold">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{color: entry.color}} className="text-sm">
            {entry.dataKey}: ${entry.value.toLocaleString()}
          </p>
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
    <div className="mb-6 p-5">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {agents.map((key, index) => (
          <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-card/50">
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

interface PortfolioChartProps {
  competitionId?: string;
  agents?: (Agent | AgentCompetition)[]
}

type PerformanceViewRecord = Record<string, {agent: string, amount: number}[]>

export const PerformanceChart: React.FC<PortfolioChartProps> = ({className, competitionId, agents}) => {
  const {data: performanceRaw, isLoading} = useCompetitionPerformance(competitionId)
  const [activeTab, setActiveTab] = useState<"agents" | "teams">("agents");
  const [dateRangeIndex, setDateRangeIndex] = useState(1); // Default to May-22 to May-24
  const [searchQuery, setSearchQuery] = useState("");

  const currentDateRange = dateRanges[dateRangeIndex];

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
    return dateArr.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(entry => {
      const points = entry[1].reduce((acc, cur) => ({
        ...acc,
        [cur.agent]: cur.amount
      }), {})

      return ({date: entry[0], ...points})
    })
  }, [performanceRaw])

  // Filter data by date range
  const filteredData = useMemo(() => {
    return parsedData || []
    //const startIndex = parsedData.findIndex(item => item.date === currentDateRange?.start);
    //const endIndex = parsedData.findIndex(item => item.date === currentDateRange?.end);
    //return allData.slice(startIndex, endIndex + 1);
  }, [parsedData, currentDateRange]);

  const filteredDataKeys = useMemo(() => {
    const res = filteredData.reduce((acc, cur) =>
    ({
      ...acc, ...cur
    }), {});

    if (res.date)
      delete res?.date;

    return Object.keys(res)
  }, [filteredData, searchQuery]);

  const agentsWithData = useMemo(() => {
    return agents?.filter(agent => filteredDataKeys.some(agentName => agentName == agent.name)) || []
  }, [agents, filteredData])

  const handlePrevRange = () => {
    setDateRangeIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextRange = () => {
    setDateRangeIndex(prev => Math.min(dateRanges.length - 1, prev + 1));
  };

  return (
    <div className={cn("w-full", className)}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "agents" | "teams")} className="w-full">
        <TabsList className="mb-6 flex gap-2">
          <TabsTrigger
            value="agents"
            className={cn(
              "rounded border border-blue-500 px-4 py-2",
              activeTab === "agents"
                ? "bg-blue-500 text-white"
                : "text-blue-500 hover:bg-blue-500/10",
            )}
          >
            Agents
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className={cn(
              "rounded border border-green-500 px-4 py-2",
              activeTab === "teams"
                ? "bg-green-500 text-white"
                : "text-green-500 hover:bg-green-500/10",
            )}
          >
            Teams
          </TabsTrigger>
        </TabsList>

        <div className="rounded-lg border">
          <div className="mb-6 bg-card w-full p-5">
            <h2 className="text-2xl font-bold text-white mb-2">Portfolio Performance</h2>
            <p className="text-gray-400">Real-time trading performance of AI competitors</p>
          </div>

          <div className="h-100">
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
                    type="monotone"
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
          <div className="border-t-2 w-full"></div>
          <CustomLegend
            agents={agentsWithData as {name: string, imageUrl: string}[]}
            colors={colors}
            searchQuery={searchQuery}
            onSearchChange={() => 1}
          />
        </div>
      </Tabs>
    </div>
  );
};
