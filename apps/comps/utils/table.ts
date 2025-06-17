import { SortState } from "@recallnet/ui2/components/table";

/**
 * Maps TanStack Table's sorting state to our table component's sort state
 * @param isSorted The sorting state from TanStack Table
 * @returns The corresponding SortState for our table component
 */
export function getSortState(isSorted: false | "asc" | "desc"): SortState {
  if (!isSorted) return "none";
  return isSorted;
}
