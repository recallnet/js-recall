import { createArena } from "./create";
import { deleteArena } from "./delete";
import { getArenaById } from "./get-by-id";
import { listArenas } from "./list";
import { updateArena } from "./update";

export const arenas = {
  create: createArena,
  list: listArenas,
  getById: getArenaById,
  update: updateArena,
  delete: deleteArena,
} as const;
