/**
 * TimelineChart component
 *
 * This is the main entry point for the TimelineChart component.
 * The implementation has been broken down into separate files for better maintainability:
 *
 * - types.ts: TypeScript interfaces and type definitions
 * - constants.ts: Colors, limits, and React context
 * - utils.ts: Utility functions (date formatting, data processing)
 * - custom-tooltip.tsx: Tooltip component for chart interactions
 * - custom-legend.tsx: Legend component with search and pagination
 * - chart-wrapper.tsx: Chart rendering and line components
 * - timeline-chart.tsx: Main component logic and state management
 * - chart-skeleton.tsx: Skeleton component for loading state
 */

export { TimelineChart } from "./timeline-chart";
export { ChartSkeleton } from "./chart-skeleton";
export { MetricTimelineChart } from "./chart-template";
export { MetricTooltip } from "./custom-tooltip";

export type {
  PortfolioChartProps,
  CustomLegendProps,
  TooltipProps,
  ChartWrapperProps,
  ChartLinesProps,
} from "./types";

export {
  CHART_COLORS,
  LIMIT_AGENTS_PER_CHART,
  HoverContext,
} from "./constants";
export { datesByWeek } from "./utils";
