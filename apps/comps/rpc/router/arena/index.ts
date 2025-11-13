import { getById } from "./get-by-id";
import { getCompetitions } from "./get-competitions";
import { list } from "./list";

export const router = {
  list,
  getById,
  getCompetitions,
} as const;
