"use client";

import React, { useMemo } from "react";

import { AgentAvatar } from "../agent-avatar";
import { CHART_COLORS } from "./constants";
import { CustomLegendProps } from "./types";

/**
 * Custom legend component for the timeline chart
 */
export const CustomLegend = ({
  agents,
  colorMap,
  currentValues,
  currentOrder,
  onAgentHover,
}: CustomLegendProps) => {
  // Sort agents by the exact order from the current hover payload, if available.
  // Fallback to sorting by value desc, then by name for stability.
  const sortedAgents = useMemo(() => {
    // Early return for no sorting needed
    if (
      !currentOrder &&
      (!currentValues || Object.keys(currentValues).length === 0)
    ) {
      return agents;
    }

    if (currentOrder && currentOrder.length > 0) {
      const orderIndex: Record<string, number> = {};
      currentOrder.forEach((name, idx) => {
        orderIndex[name] = idx;
      });
      return [...agents].sort((a, b) => {
        const ai = orderIndex[a.name] ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndex[b.name] ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        // tie-breaker using value desc if available, otherwise alpha
        const va = currentValues?.[a.name] ?? -Infinity;
        const vb = currentValues?.[b.name] ?? -Infinity;
        if (va !== vb) return vb - va;
        return a.name.localeCompare(b.name);
      });
    }

    return [...agents].sort((a, b) => {
      const va = currentValues?.[a.name] ?? -Infinity;
      const vb = currentValues?.[b.name] ?? -Infinity;
      if (va !== vb) return vb - va;
      return a.name.localeCompare(b.name);
    });
  }, [agents, currentOrder, currentValues]);

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {sortedAgents.map((agent) => {
          return (
            <div
              key={agent.name}
              className="flex min-w-0 cursor-default items-center gap-2 rounded-lg p-2 transition-all duration-200 hover:scale-110"
              onMouseEnter={() => onAgentHover?.(agent.name)}
              onMouseLeave={() => onAgentHover?.(null)}
            >
              <AgentAvatar
                agent={agent}
                size={32}
                className="hover:scale-100 hover:transform-none"
                style={{
                  borderColor: colorMap[agent.name] || CHART_COLORS[0],
                }}
              />

              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                style={{ color: colorMap[agent.name] || CHART_COLORS[0] }}
              >
                {agent.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
