"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@recallnet/ui2/components/input";

import { Pagination } from "../pagination";
import { LIMIT_AGENTS_PER_PAGE, colors } from "./constants";
import { CustomLegendProps } from "./types";

/**
 * Custom legend component for the timeline chart
 */
export const CustomLegend = ({
  agents,
  colorMap,
  currentValues,
  currentOrder,
  searchQuery,
  onSearchChange,
  onAgentHover,
  totalAgents = 0,
  currentPage = 1,
  onPageChange,
  onSearchPageChange,
}: CustomLegendProps) => {
  // Internal pagination state for search results
  const [searchPage, setSearchPage] = useState(1);

  // Reset search page when search query changes
  useEffect(() => {
    setSearchPage(1);
    onSearchPageChange?.(1);
  }, [searchQuery, onSearchPageChange]);

  // Create a wrapper for search page changes that notifies parent
  const handleSearchPageChange = useCallback(
    (page: number) => {
      setSearchPage(page);
      onSearchPageChange?.(page);
    },
    [onSearchPageChange],
  );

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

  // Handle pagination for search vs normal mode
  const { displayAgents, paginationProps } = useMemo(() => {
    if (searchQuery) {
      // When searching, paginate the sorted search results
      const startIndex = (searchPage - 1) * LIMIT_AGENTS_PER_PAGE;
      const endIndex = startIndex + LIMIT_AGENTS_PER_PAGE;
      const paginatedSearchResults = sortedAgents.slice(startIndex, endIndex);

      return {
        displayAgents: paginatedSearchResults,
        paginationProps: {
          totalItems: sortedAgents.length,
          currentPage: searchPage,
          onPageChange: handleSearchPageChange,
        },
      };
    } else {
      // When not searching, use parent pagination (agents already paginated)
      return {
        displayAgents: sortedAgents,
        paginationProps: {
          totalItems: totalAgents,
          currentPage: currentPage,
          onPageChange: onPageChange,
        },
      };
    }
  }, [
    sortedAgents,
    searchQuery,
    searchPage,
    totalAgents,
    currentPage,
    onPageChange,
    handleSearchPageChange,
  ]);

  return (
    <div className="p-5">
      <div className="text-secondary-foreground relative mb-4 max-w-[500px]">
        <Input
          type="text"
          placeholder="Search for an agent..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-full"
        />
        <Search className="absolute bottom-3 right-5" size={16} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {displayAgents.map((agent) => {
          return (
            <div
              key={agent.name}
              className="flex min-w-0 cursor-default items-center gap-2 rounded-lg p-2 transition-all duration-200 hover:scale-105"
              onMouseEnter={() => onAgentHover?.(agent.name)}
              onMouseLeave={() => onAgentHover?.(null)}
            >
              <div
                className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border-2"
                style={{ borderColor: colorMap[agent.name] || colors[0] }}
              >
                <Image
                  src={agent.imageUrl || `/default_agent_2.png`}
                  alt={agent.name}
                  width={15}
                  height={15}
                  className="h-full w-full"
                />
              </div>
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                style={{ color: colorMap[agent.name] || colors[0] }}
              >
                {agent.name}
              </span>
            </div>
          );
        })}
      </div>

      {paginationProps.onPageChange &&
        paginationProps.totalItems > LIMIT_AGENTS_PER_PAGE && (
          <Pagination
            totalItems={paginationProps.totalItems}
            currentPage={paginationProps.currentPage}
            itemsPerPage={LIMIT_AGENTS_PER_PAGE}
            onPageChange={paginationProps.onPageChange}
          />
        )}
    </div>
  );
};
