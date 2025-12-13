import { getBadgeStatusesForAgent } from "./get-badge-statuses-for-agent";
import { getBulkBadgeStatuses } from "./get-bulk-badge-statuses";
import { getCompetitionStats } from "./get-competition-stats";

export const router = {
  getBadgeStatusesForAgent,
  getBulkBadgeStatuses,
  getCompetitionStats,
} as const;
