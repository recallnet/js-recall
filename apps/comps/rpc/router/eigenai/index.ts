import { getBulkBadgeStatuses } from "./get-bulk-badge-statuses";
import { getCompetitionStats } from "./get-competition-stats";

export const router = {
  getBulkBadgeStatuses,
  getCompetitionStats,
} as const;
