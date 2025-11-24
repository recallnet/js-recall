import { createAgent } from "./create";
import { deactivateAgent } from "./deactivate";
import { deleteAgent } from "./delete";
import { getAgentById } from "./get-by-id";
import { listAgents } from "./list";
import { reactivateAgent } from "./reactivate";
import { updateAgent } from "./update";

export const agents = {
  create: createAgent,
  list: listAgents,
  getById: getAgentById,
  update: updateAgent,
  delete: deleteAgent,
  deactivate: deactivateAgent,
  reactivate: reactivateAgent,
} as const;
