import { createContext } from "react";

/**
 * Constants for TimelineChart components
 */

export const colors = [
  "#FF6B35", // Orange
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Light Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light Yellow
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
