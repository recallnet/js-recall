import { createContext } from "react";

/**
 * Constants for TimelineChart components
 */

/**
 * Colors for the chart lines
 */
export const CHART_COLORS = [
  "#cc66ff", // Purple
  "#38a430", // Green
  "#d94545", // Red
  "#f9b700", // Yellow
  "#b3ff66", // Light Green
  "#6366f1", // Indigo
  "#ff9933", // Orange
  "#00ffff", // Cyan
] as const;

/**
 * Number of agents per paginated page (e.g., tables)
 */
export const LIMIT_AGENTS_PER_PAGE = 20;

/**
 * Number of agents displayed on charts
 */
export const LIMIT_AGENTS_PER_CHART = 12;

/**
 * Context for hover state to avoid prop drilling and chart re-renders
 */
export const HoverContext = createContext<{
  hoveredAgent: string | null;
  setHoveredAgent: (agent: string | null) => void;
}>({
  hoveredAgent: null,
  setHoveredAgent: () => {},
});

/**
 * Start date of boosted competitions
 */
export const boostedCompetitionsStartDate = new Date("2025-10-20T00:00:00Z");
