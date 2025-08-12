import { useCallback, useState } from "react";

import { SortState } from "@recallnet/ui2/components/table";

/**
 * Custom hook for managing table sorting state consistently across components
 * @param initialSort Optional initial sort field in format "field" or "-field"
 * @returns Object containing sortState, handleSortChange, and getSortString functions
 */
export function useSorting(initialSort?: string) {
  const [sortState, setSortState] = useState<Record<string, SortState>>(() => {
    if (!initialSort) return {};

    // Parse initial sort string to set initial state
    const isDesc = initialSort.startsWith("-");
    const field = isDesc ? initialSort.slice(1) : initialSort;
    return { [field]: isDesc ? "desc" : "asc" };
  });

  /**
   * Handle sort change for a specific field
   * Cycles through: none -> asc -> desc -> none
   */
  const handleSortChange = useCallback((field: string) => {
    setSortState((prev) => {
      const current = prev[field] || "none";
      const next =
        current === "none" ? "asc" : current === "asc" ? "desc" : "none";

      // Clear all other fields when setting a new sort (single column sorting)
      return { [field]: next };
    });
  }, []);

  /**
   * Get the current sort string in API format
   * @returns Sort string like "field" or "-field" or empty string if no sorting
   */
  const getSortString = useCallback(() => {
    const activeSorts = Object.entries(sortState)
      .filter(([, state]) => state !== "none")
      .map(([field, state]) => `${state === "desc" ? "-" : ""}${field}`);

    return activeSorts.join(",");
  }, [sortState]);

  /**
   * Reset all sorting to "none" state
   */
  const resetSorting = useCallback(() => {
    setSortState({});
  }, []);

  return {
    sortState,
    handleSortChange,
    getSortString,
    resetSorting,
  };
}
