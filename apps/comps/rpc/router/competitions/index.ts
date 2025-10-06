import { GetAgentsType, getAgents } from "./get-agents";
import { GetByIdType, getById } from "./get-by-id";
import { GetTimelineType, getTimeline } from "./get-timeline";
import { ListEnrichedType, listEnriched } from "./list-enriched";

export const router: {
  listEnriched: ListEnrichedType;
  getById: GetByIdType;
  getAgents: GetAgentsType;
  getTimeline: GetTimelineType;
} = {
  listEnriched,
  getById,
  getAgents,
  getTimeline,
};
