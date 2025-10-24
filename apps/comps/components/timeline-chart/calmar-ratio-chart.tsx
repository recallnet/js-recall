"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@recallnet/ui2/lib/utils";

import { RouterOutputs } from "@/rpc/router";

import { CHART_COLORS, HoverContext } from "./constants";
import { CustomLegend } from "./custom-legend";

interface CalmarRatioChartProps {
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
}

export const CalmarRatioChart: React.FC<CalmarRatioChartProps> = ({
  agents,
}) => {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [legendHoveredAgent, setLegendHoveredAgent] = useState<string | null>(
    null,
  );

  // Filter agents with valid Calmar ratios
  const agentsWithCalmar = useMemo(() => {
    return agents.filter(
      (agent) => agent.calmarRatio !== null && agent.calmarRatio !== undefined,
    );
  }, [agents]);

  // Prepare data for bar chart
  const perpsChartData = useMemo(() => {
    return agentsWithCalmar
      .sort((a, b) => (b.calmarRatio || 0) - (a.calmarRatio || 0))
      .map((agent) => ({
        name: agent.name,
        handle: agent.handle,
        calmarRatio: agent.calmarRatio || 0,
        displayName:
          agent.handle.length > 12
            ? `${agent.handle.slice(0, 10)}...`
            : agent.handle,
      }));
  }, [agentsWithCalmar]);

  // Create color mapping from all filtered agents for consistency
  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    agentsWithCalmar.forEach((agent, index) => {
      map[agent.name] = CHART_COLORS[index % CHART_COLORS.length]!;
    });
    return map;
  }, [agentsWithCalmar]);

  // Calmar ratio values for legend
  const calmarRatioValues = useMemo(() => {
    const values: Record<string, number> = {};
    agentsWithCalmar.forEach((agent) => {
      if (agent.calmarRatio !== null && agent.calmarRatio !== undefined) {
        values[agent.name] = agent.calmarRatio;
      }
    });
    return values;
  }, [agentsWithCalmar]);

  // Dynamic Y-axis domain
  const perpsYAxisDomain = useMemo(() => {
    if (!perpsChartData.length) return [-5, 10];
    const values = perpsChartData.map((d) => d.calmarRatio);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Ensure 0 is always visible
    const domainMin = Math.min(minValue, 0);
    const domainMax = Math.max(maxValue, 0);

    // Add padding
    const padding = Math.max(
      Math.abs(domainMax * 0.1),
      Math.abs(domainMin * 0.1),
      0.5,
    );

    return [
      Math.floor((domainMin - padding) * 10) / 10,
      Math.ceil((domainMax + padding) * 10) / 10,
    ];
  }, [perpsChartData]);

  return (
    <>
      <HoverContext.Provider
        value={{
          hoveredAgent: legendHoveredAgent,
          setHoveredAgent: setLegendHoveredAgent,
        }}
      >
        <div className="h-[400px] w-full px-6 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={perpsChartData}
              barCategoryGap="20%"
              margin={{ right: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

              <XAxis
                dataKey="displayName"
                stroke="#9CA3AF"
                tick={false}
                axisLine={{ stroke: "#9CA3AF" }}
              />

              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                domain={perpsYAxisDomain}
                tickFormatter={(value) => value.toFixed(1)}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card z-50 rounded-lg border border-gray-600 p-3 shadow-lg">
                        <p className="text-sm font-semibold text-white">
                          {data.name}
                        </p>
                        <p className="text-secondary-foreground text-xs">
                          @{data.handle}
                        </p>
                        <div className="my-2 w-full border-t border-gray-600"></div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-secondary-foreground">
                            Calmar Ratio:
                          </span>
                          <span
                            className={cn(
                              "font-bold",
                              data.calmarRatio > 0
                                ? "text-green-500"
                                : data.calmarRatio < 0
                                  ? "text-red-500"
                                  : "text-gray-400",
                            )}
                          >
                            {data.calmarRatio.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <ReferenceLine
                y={0}
                stroke="#6B7280"
                strokeWidth={2}
                strokeDasharray="3 3"
              />

              <Bar
                dataKey="calmarRatio"
                radius={[4, 4, 0, 0]}
                onMouseEnter={(data) => {
                  if (data && typeof data === "object" && "name" in data) {
                    setHoveredBar(data.name as string);
                    setLegendHoveredAgent(data.name as string);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredBar(null);
                  setLegendHoveredAgent(null);
                }}
              >
                {perpsChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      agentColorMap[entry.name] ||
                      CHART_COLORS[index % CHART_COLORS.length]
                    }
                    opacity={hoveredBar && hoveredBar !== entry.name ? 0.5 : 1}
                    style={{
                      cursor: "default",
                      transition: "opacity 0.2s",
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </HoverContext.Provider>
      <div className="my-2 w-full border-t"></div>
      <CustomLegend
        agents={agentsWithCalmar}
        colorMap={agentColorMap}
        currentValues={calmarRatioValues}
        onAgentHover={setLegendHoveredAgent}
      />
      <div className="border-t px-6 py-3">
        <p className="text-xs text-gray-500">
          * Calmar Ratio = Annualized Return / Max Drawdown
        </p>
        <p className="text-xs text-gray-500">
          * Agents need at least 2 snapshots for risk metrics calculation
        </p>
      </div>
    </>
  );
};
