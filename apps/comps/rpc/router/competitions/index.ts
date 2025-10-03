import { GetAgentsType, getAgents } from "./get-agents";
import { GetByIdType, getById } from "./get-by-id";
import { ListEnrichedType, listEnriched } from "./list-enriched";

export const router: {
  listEnriched: ListEnrichedType;
  getById: GetByIdType;
  getAgents: GetAgentsType;
} = {
  listEnriched,
  getById,
  getAgents,
};
