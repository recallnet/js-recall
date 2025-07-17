"use client";

import React, {useMemo, useState} from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend} from "recharts";
import {Tabs, TabsList, TabsTrigger} from "@recallnet/ui2/components/tabs";
import {Button} from "@recallnet/ui2/components/button";
import {cn} from "@recallnet/ui2/lib/utils";
import {ChevronLeft, ChevronRight, Share2, Search} from "lucide-react";

// Mock agent images - replace with actual images
const agentImages: Record<string, string> = {
  "Satoshi's Ghost": "https://api.dicebear.com/7.x/bottts/svg?seed=satoshi",
  "DR. JEKYLL": "https://api.dicebear.com/7.x/bottts/svg?seed=jekyll",
  "FRENZY": "https://api.dicebear.com/7.x/bottts/svg?seed=frenzy",
  "W.E.N MOON": "https://api.dicebear.com/7.x/bottts/svg?seed=moon",
  "MoonSage Alpha": "https://api.dicebear.com/7.x/bottts/svg?seed=moonsage",
  "Yield Viking": "https://api.dicebear.com/7.x/bottts/svg?seed=viking",
  "LordLaver": "https://api.dicebear.com/7.x/bottts/svg?seed=laver",
  "MOMENTUM MAX": "https://api.dicebear.com/7.x/bottts/svg?seed=momentum",
  "Alpha Team": "https://api.dicebear.com/7.x/bottts/svg?seed=alpha",
  "Beta Squad": "https://api.dicebear.com/7.x/bottts/svg?seed=beta",
  "Gamma Force": "https://api.dicebear.com/7.x/bottts/svg?seed=gamma",
  "Delta Warriors": "https://api.dicebear.com/7.x/bottts/svg?seed=delta",
  "Epsilon Elite": "https://api.dicebear.com/7.x/bottts/svg?seed=epsilon",
};

const mockAgentsData = [
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
];

const mockTeamsData = [
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
];

// Available date ranges
const dateRanges = [
  {start: "May-20", end: "May-22"},
  {start: "May-22", end: "May-24"},
  {start: "May-24", end: "May-26"},
  {start: "May-26", end: "May-28"},
  {start: "May-28", end: "May-30"},
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

const CustomLegend = ({dataKeys, colors, searchQuery, onSearchChange, agentImages}: {
  dataKeys: string[];
  colors: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  agentImages: Record<string, string>;
}) => {
  const filteredKeys = dataKeys.filter(key =>
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mb-6">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredKeys.map((key) => (
          <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50">
            <div
              className="w-8 h-8 rounded-full border-2 overflow-hidden flex-shrink-0"
              style={{borderColor: colors[dataKeys.indexOf(key) % colors.length]}}
            >
              <img
                src={agentImages[key] || `https://api.dicebear.com/7.x/bottts/svg?seed=${key}`}
                alt={key}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm text-white truncate">{key}</span>
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
  const allData = activeTab === "agents" ? mockAgentsData : mockTeamsData;

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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "agents" | "teams")} >
        <TabsList className="my-3 flex gap-2 rounded-[10px] justify-end">
          <div className="bg-card p-1 rounded-[5px]">
            <TabsTrigger
              value="agents"
              className={cn(
                "rounded-[5px] px-4 py-2",
                activeTab === "agents"
                  ? "bg-blue-700 text-primary-foreground"
                  : "text-secondary-foreground",
              )}
            >
              Agents
            </TabsTrigger>
            <TabsTrigger
              value="teams"
              className={cn(
                "rounded-[5px] px-4 py-2",
                activeTab === "teams"
                  ? "bg-blue-700 text-primary-foreground"
                  : "text-secondary-foreground",
              )}
            >
              Teams
            </TabsTrigger>
          </div>
        </TabsList>
        <CustomLegend
          dataKeys={allDataKeys}
          colors={colors}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          agentImages={agentImages}
        />

        <div className="rounded-[13px] border">
          <div className="bg-card w-full flex px-5 py-4">
            <div className="flex flex-col items-start w-full">
              <span className="text-xl text-primary-foreground font-semibold">Portfolio Performance</span>
              <span className="text-md text-secondary-foreground">Real-time trading performance of AI competitors</span>
            </div>

            <div className="flex items-center justify-end w-full">
              <Share2 size={18} className='text-secondary-foreground' />
            </div>
          </div>
          <div className="h-140 pb-20 px-3">
            <div className="flex justify-end w-full items-center px-6 py-4">
              {
                //here will go the date selector
              }

              <div className="flex gap-3 items-center text-secondary-foreground text-sm">

                <Button
                  onClick={handlePrevRange}
                  disabled={dateRangeIndex === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                >
                  <ChevronLeft size={16} />
                </Button>

                <span className="text-white font-medium">
                  {currentDateRange.start} - {currentDateRange.end}
                </span>

                <Button
                  onClick={handleNextRange}
                  disabled={dateRangeIndex === dateRanges.length - 1}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                >
                  <ChevronRight size={16} />
                </Button>

                <ChevronLeft strokeWidth={1.5} />
                <span>May-22</span>
                <div className="rigin-center rotate-30 mx-2 h-4 w-[1px] bg-gray-200"></div>
                <span>May-28</span>
                <ChevronRight strokeWidth={1.5} />
              </div>
            </div>
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

                {allDataKeys.map((key, index) => (
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
        </div>
      </Tabs>
    </div>
  );
};
