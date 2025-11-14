import { getById } from "./get-by-id";
import { list } from "./list";

export const router = {
  list,
  getById,
} as const;
