"use client";

import React from "react";

import { LIMIT_AGENTS_PER_CHART } from "./constants";

/**
 * Custom tooltip component for metric timeline charts
 */
interface MetricTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | null;
    dataKey: string;
    color: string;
    payload?: { displayTimestamp?: string };
  }>;
  yAxisType?: "currency" | "percentage" | "number";
  hoveredAgent?: string | null;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  active,
  payload,
  yAxisType = "number",
  hoveredAgent = null,
}) => {
  if (!active || !payload || !payload.length) return null;

  // Filter out null values
  let filteredPayload = [...payload].filter(
    (entry) => entry.value !== null && entry.value !== undefined,
  );

  // If a specific agent is hovered, only show that agent's data
  if (hoveredAgent) {
    filteredPayload = filteredPayload.filter(
      (entry) => entry.dataKey === hoveredAgent,
    );
  }

  // Sort by value descending
  const sortedPayload = filteredPayload.sort(
    (a, b) => (b.value as number) - (a.value as number),
  );

  // If all values are null, don't show tooltip
  if (sortedPayload.length === 0) return null;

  return (
    <div className="bg-card z-50 rounded-lg border border-gray-600 p-3 shadow-lg">
      <p className="text-secondary-foreground mb-2 text-xs">
        {payload[0]?.payload?.displayTimestamp || ""}
      </p>
      <div className="space-y-1">
        {sortedPayload
          .slice(0, hoveredAgent ? 1 : LIMIT_AGENTS_PER_CHART)
          .map((entry, index) => (
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
                {yAxisType === "currency"
                  ? `$${((entry.value as number) / 1000).toFixed(1)}k`
                  : yAxisType === "percentage"
                    ? `${(entry.value as number).toFixed(2)}%`
                    : (entry.value as number).toFixed(2)}
              </span>
            </div>
          ))}
        {!hoveredAgent && sortedPayload.length > LIMIT_AGENTS_PER_CHART && (
          <p className="text-secondary-foreground text-xs">
            +{sortedPayload.length - LIMIT_AGENTS_PER_CHART} more
          </p>
        )}
      </div>
    </div>
  );
};
