"use client";

import React, { memo, useMemo } from "react";

import { TooltipProps } from "./types";
import { formatDateShort } from "./utils";

/**
 * Custom tooltip component for the timeline chart
 */

// Inner component that renders the tooltip content
const TooltipContent = memo(
  ({ active, payload, label }: TooltipProps) => {
    // Format the label to use pretty date format
    const formattedLabel = useMemo(() => {
      if (!label) return label;
      // Try to format as pretty date, fallback to original if it's already formatted
      try {
        const date = new Date(label as string);
        if (isNaN(date.getTime())) {
          // If it's not a valid date, return as-is (might already be formatted)
          return label;
        }
        return formatDateShort(date);
      } catch {
        return label;
      }
    }, [label]);

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
        <span className="text-secondary-foreground text-sm">
          {formattedLabel}
        </span>
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
export const CustomTooltip = (props: TooltipProps) => {
  return <TooltipContent {...props} />;
};
