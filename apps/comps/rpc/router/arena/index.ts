import { getById } from "./get-by-id";
import { getCompetitions } from "./get-competitions";
import { getStats } from "./get-stats";
import { list } from "./list";

export const router = {
  list,
  getById,
  getCompetitions,
  getStats,
} as const;
