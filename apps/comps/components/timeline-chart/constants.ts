import { createContext } from "react";

/**
 * Constants for TimelineChart components
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
];

export const LIMIT_AGENTS_PER_PAGE = 10;

// Context for hover state to avoid prop drilling and chart re-renders
export const HoverContext = createContext<{
  hoveredAgent: string | null;
  setHoveredAgent: (agent: string | null) => void;
}>({
  hoveredAgent: null,
  setHoveredAgent: () => {},
});
