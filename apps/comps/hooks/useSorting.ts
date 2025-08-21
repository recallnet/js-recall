import { useCallback, useState } from "react";

import { SortState } from "@recallnet/ui2/components/table";

/**
 * Custom hook for managing table sorting state consistently across components
 * @param sortDescFirst Optional configuration for field-specific default directions on first click
 * @returns Object containing sortState, handleSortChange, and getSortString functions
 */
export function useSorting(sortDescFirst?: Record<string, boolean>) {
  const [sortState, setSortState] = useState<Record<string, SortState>>({});

  /**
   * Handle sort change for a specific field
   * Cycles through: none -> (desc|asc based on sortDescFirst) -> (opposite) -> none
   * Uses sortDescFirst configuration to determine initial direction
   */
  const handleSortChange = useCallback(
    (field: string) => {
      setSortState((prev) => {
        const current = prev[field] || "none";
        const shouldStartWithDesc = sortDescFirst?.[field] ?? true; // Default to desc if not specified

        let next: SortState;
        if (current === "none") {
          // First click: use the configured default direction
          next = shouldStartWithDesc ? "desc" : "asc";
        } else if (shouldStartWithDesc) {
          // For desc-first fields: none -> desc -> asc -> none
          next = current === "desc" ? "asc" : "none";
        } else {
          // For asc-first fields: none -> asc -> desc -> none
          next = current === "asc" ? "desc" : "none";
        }

        // Clear all other fields when setting a new sort (single column sorting)
        return { [field]: next };
      });
    },
    [sortDescFirst],
  );

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
