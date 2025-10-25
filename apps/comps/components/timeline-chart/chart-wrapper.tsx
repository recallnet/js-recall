"use client";

import React, { memo, useContext } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDateShort } from "@/utils/format";

import { HoverContext } from "./constants";
import { MetricTooltip } from "./custom-tooltip";
import { ChartLinesProps, ChartWrapperProps } from "./types";

/**
 * Chart wrapper and lines components for the timeline chart
 */

// Memoized chart lines component to prevent unnecessary re-renders
const ChartLines = memo(
  ({ dataKeys, colorMap, isAnimationActive }: ChartLinesProps) => {
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

// Memoized chart wrapper to prevent axis flickering
export const ChartWrapper = memo(
  ({
    filteredData,
    filteredDataKeys,
    agentColorMap,
    shouldAnimate,
    isFullRange,
    onHoverChange,
  }: ChartWrapperProps) => {
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
                  let formattedLabel: string;

                  if (dataPoint && dataPoint.originalTimestamp) {
                    formattedLabel = formatDateShort(
                      dataPoint.originalTimestamp as string,
                    );
                  } else {
                    formattedLabel = formatDateShort(value as string);
                  }

                  // Check if this formatted label already appeared recently to prevent duplicates
                  // Look at previous labels within a small window
                  const checkWindow = Math.min(5, index);
                  for (
                    let i = Math.max(0, index - checkWindow);
                    i < index;
                    i++
                  ) {
                    const prevDataPoint = filteredData[i];
                    let prevLabel: string;

                    if (prevDataPoint && prevDataPoint.originalTimestamp) {
                      prevLabel = formatDateShort(
                        prevDataPoint.originalTimestamp as string,
                      );
                    } else {
                      prevLabel = formatDateShort(
                        filteredData[i]?.timestamp as string,
                      );
                    }

                    if (
                      prevLabel === formattedLabel &&
                      (i % step === 0 || i === 0 || i === totalPoints - 1)
                    ) {
                      // This label already appeared, skip it
                      return "";
                    }
                  }

                  return formattedLabel;
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
            domain={[
              (dataMin: number) => dataMin * 0.95,
              (dataMax: number) => dataMax * 1.05,
            ]}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            content={(props) => <MetricTooltip {...props} />}
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
