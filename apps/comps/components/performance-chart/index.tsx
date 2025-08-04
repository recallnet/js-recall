"use client";

import React, {useState, useMemo} from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from "recharts";
import {Tabs, TabsList, TabsTrigger} from "@recallnet/ui2/components/tabs";
import {cn} from "@recallnet/ui2/lib/utils";
import {Share2, ChevronLeft, ChevronRight, Search} from "lucide-react";
import Image from "next/image";
import {Input} from "@recallnet/ui2/components/input";

// Mock data for demonstration with extended date range
const allMockAgentsData = [
  {
    date: "May-20",
    "Satoshi's Ghost": 23900,
    "DR. JEKYLL": 23600,
    "FRENZY": 23300,
    "W.E.N MOON": 24000,
    "MoonSage Alpha": 23700,
    "Yield Viking": 23800,
    "LordLaver": 23400,
    "MOMENTUM MAX": 23500,
  },
  {
    date: "May-21",
    "Satoshi's Ghost": 24000,
    "DR. JEKYLL": 23700,
    "FRENZY": 23400,
    "W.E.N MOON": 24100,
    "MoonSage Alpha": 23800,
    "Yield Viking": 23900,
    "LordLaver": 23500,
    "MOMENTUM MAX": 23600,
  },
  {
    date: "May-22",
    "Satoshi's Ghost": 24100,
    "DR. JEKYLL": 23800,
    "FRENZY": 23500,
    "W.E.N MOON": 24200,
    "MoonSage Alpha": 23900,
    "Yield Viking": 24000,
    "LordLaver": 23600,
    "MOMENTUM MAX": 23700,
  },
  {
    date: "May-23",
    "Satoshi's Ghost": 24200,
    "DR. JEKYLL": 23900,
    "FRENZY": 23600,
    "W.E.N MOON": 24300,
    "MoonSage Alpha": 24000,
    "Yield Viking": 23800,
    "LordLaver": 23500,
    "MOMENTUM MAX": 23800,
  },
  {
    date: "May-24",
    "Satoshi's Ghost": 24300,
    "DR. JEKYLL": 24000,
    "FRENZY": 23800,
    "W.E.N MOON": 24400,
    "MoonSage Alpha": 24100,
    "Yield Viking": 23900,
    "LordLaver": 23700,
    "MOMENTUM MAX": 23900,
  },
  {
    date: "May-25",
    "Satoshi's Ghost": 24500,
    "DR. JEKYLL": 24200,
    "FRENZY": 24000,
    "W.E.N MOON": 24600,
    "MoonSage Alpha": 24300,
    "Yield Viking": 24100,
    "LordLaver": 23900,
    "MOMENTUM MAX": 24000,
  },
  {
    date: "May-26",
    "Satoshi's Ghost": 24400,
    "DR. JEKYLL": 24100,
    "FRENZY": 23900,
    "W.E.N MOON": 24500,
    "MoonSage Alpha": 24200,
    "Yield Viking": 24000,
    "LordLaver": 23800,
    "MOMENTUM MAX": 23900,
  },
  {
    date: "May-27",
    "Satoshi's Ghost": 24600,
    "DR. JEKYLL": 24300,
    "FRENZY": 24100,
    "W.E.N MOON": 24700,
    "MoonSage Alpha": 24400,
    "Yield Viking": 24200,
    "LordLaver": 24000,
    "MOMENTUM MAX": 24100,
  },
  {
    date: "May-28",
    "Satoshi's Ghost": 24500,
    "DR. JEKYLL": 24200,
    "FRENZY": 24000,
    "W.E.N MOON": 24600,
    "MoonSage Alpha": 24300,
    "Yield Viking": 24100,
    "LordLaver": 23900,
    "MOMENTUM MAX": 24000,
  },
  {
    date: "May-29",
    "Satoshi's Ghost": 24700,
    "DR. JEKYLL": 24400,
    "FRENZY": 24200,
    "W.E.N MOON": 24800,
    "MoonSage Alpha": 24500,
    "Yield Viking": 24300,
    "LordLaver": 24100,
    "MOMENTUM MAX": 24200,
  },
  {
    date: "May-30",
    "Satoshi's Ghost": 24800,
    "DR. JEKYLL": 24500,
    "FRENZY": 24300,
    "W.E.N MOON": 24900,
    "MoonSage Alpha": 24600,
    "Yield Viking": 24400,
    "LordLaver": 24200,
    "MOMENTUM MAX": 24300,
  },
];

const allMockTeamsData = [
  {
    date: "May-20",
    "Alpha Team": 24000,
    "Beta Squad": 23600,
    "Gamma Force": 23400,
    "Delta Warriors": 23900,
    "Epsilon Elite": 23700,
  },
  {
    date: "May-21",
    "Alpha Team": 24100,
    "Beta Squad": 23700,
    "Gamma Force": 23500,
    "Delta Warriors": 24000,
    "Epsilon Elite": 23800,
  },
  {
    date: "May-22",
    "Alpha Team": 24200,
    "Beta Squad": 23800,
    "Gamma Force": 23600,
    "Delta Warriors": 24100,
    "Epsilon Elite": 23900,
  },
  {
    date: "May-23",
    "Alpha Team": 24300,
    "Beta Squad": 23900,
    "Gamma Force": 23700,
    "Delta Warriors": 24200,
    "Epsilon Elite": 24000,
  },
  {
    date: "May-24",
    "Alpha Team": 24400,
    "Beta Squad": 24000,
    "Gamma Force": 23800,
    "Delta Warriors": 24300,
    "Epsilon Elite": 24100,
  },
  {
    date: "May-25",
    "Alpha Team": 24600,
    "Beta Squad": 24200,
    "Gamma Force": 24000,
    "Delta Warriors": 24500,
    "Epsilon Elite": 24300,
  },
  {
    date: "May-26",
    "Alpha Team": 24500,
    "Beta Squad": 24100,
    "Gamma Force": 23900,
    "Delta Warriors": 24400,
    "Epsilon Elite": 24200,
  },
  {
    date: "May-27",
    "Alpha Team": 24700,
    "Beta Squad": 24300,
    "Gamma Force": 24100,
    "Delta Warriors": 24600,
    "Epsilon Elite": 24400,
  },
  {
    date: "May-28",
    "Alpha Team": 24600,
    "Beta Squad": 24200,
    "Gamma Force": 24000,
    "Delta Warriors": 24500,
    "Epsilon Elite": 24300,
  },
  {
    date: "May-29",
    "Alpha Team": 24800,
    "Beta Squad": 24400,
    "Gamma Force": 24200,
    "Delta Warriors": 24700,
    "Epsilon Elite": 24500,
  },
  {
    date: "May-30",
    "Alpha Team": 24900,
    "Beta Squad": 24500,
    "Gamma Force": 24300,
    "Delta Warriors": 24800,
    "Epsilon Elite": 24600,
  },
];

// Color palette for lines
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
const CustomLegend = ({dataKeys, colors, searchQuery, onSearchChange}: {
  dataKeys: string[];
  colors: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) => {
  const filteredKeys = dataKeys.filter(key =>
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        {filteredKeys.map((key, index) => (
          <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-card/50">
            <div
              className="w-8 h-8 rounded-full border-2 overflow-hidden flex-shrink-0"
              style={{borderColor: colors[dataKeys.indexOf(key) % colors.length]}}
            >
              <Image
                src={`/default_agent_2.png`}
                alt={key}
                width={15}
                height={15}
                className="w-full h-full"
              />
            </div>
            <span className="text-sm text-primary-foreground truncate">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PortfolioChartProps {
  className?: string;
}

export const PerformanceChart: React.FC<PortfolioChartProps> = ({className}) => {
  const [activeTab, setActiveTab] = useState<"agents" | "teams">("agents");
  const [dateRangeIndex, setDateRangeIndex] = useState(1); // Default to May-22 to May-24
  const [searchQuery, setSearchQuery] = useState("");

  const currentDateRange = dateRanges[dateRangeIndex];
  const allData = activeTab === "agents" ? allMockAgentsData : allMockTeamsData;

  // Filter data by date range
  const filteredData = useMemo(() => {
    const startIndex = allData.findIndex(item => item.date === currentDateRange.start);
    const endIndex = allData.findIndex(item => item.date === currentDateRange.end);
    return allData.slice(startIndex, endIndex + 1);
  }, [allData, currentDateRange]);

  const allDataKeys = Object.keys(filteredData[0] || {}).filter(key => key !== "date");

  // Filter keys based on search
  const filteredDataKeys = useMemo(() => {
    return allDataKeys.filter(key =>
      key.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allDataKeys, searchQuery]);

  // Create filtered data with only searched agents/teams
  const chartData = useMemo(() => {
    return filteredData.map(item => {
      const newItem: any = {date: item.date};
      filteredDataKeys.forEach(key => {
        newItem[key] = item[key as keyof typeof item];
      });
      return newItem;
    });
  }, [filteredData, filteredDataKeys]);

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
                data={chartData}
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
            dataKeys={filteredDataKeys}
            colors={colors}
            searchQuery={searchQuery}
            onSearchChange={() => 1}
          />
        </div>
      </Tabs>
    </div>
  );
};
