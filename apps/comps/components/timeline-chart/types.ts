import { RouterOutputs } from "@/rpc/router";

/**
 * Types for TimelineChart components
 */

export interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    color: string;
    dataKey: string;
    value: number;
    [key: string]: unknown;
  }>;
  label?: string | number;
}

export interface CustomLegendProps {
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
  colorMap: Record<string, string>;
  currentValues?: Record<string, number>;
  currentOrder?: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAgentHover?: (agentName: string | null) => void;
  totalAgents?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSearchPageChange?: (page: number) => void;
  agentsPerPage?: number;
}

export interface PortfolioChartProps {
  competition: RouterOutputs["competitions"]["getById"];
  agents: RouterOutputs["competitions"]["getAgents"]["agents"]; // Current page agents from parent pagination
  className?: string;
  totalAgents?: number; // Total number of agents for pagination
  currentPage?: number; // Current page from parent
  onPageChange?: (page: number) => void; // Page change handler
  suppressInternalLoading?: boolean; // Skip internal loading skeleton when parent handles loading
}

export interface ChartWrapperProps {
  filteredData: Array<Record<string, string | number>>;
  filteredDataKeys: string[];
  agentColorMap: Record<string, string>;
  shouldAnimate: boolean;
  isFullRange?: boolean;
  onHoverChange?: (
    data: Record<string, number> | null,
    order?: string[],
  ) => void;
}

export interface ChartLinesProps {
  dataKeys: string[];
  colorMap: Record<string, string>;
  isAnimationActive: boolean;
}

export type TimelineViewRecord = Record<
  string,
  { agent: string; amount: number }[]
>;

export type DateArr = { timestamp: string }[];
