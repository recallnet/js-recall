import { GetAgentsType, getAgents } from "./get-agents";
import { GetByIdType, getById } from "./get-by-id";
import {
  GetPerpsPositionsType,
  getPerpsPositions,
} from "./get-perps-positions";
import { GetTimelineType, getTimeline } from "./get-timeline";
import { ListEnrichedType, listEnriched } from "./list-enriched";

export const router: {
  listEnriched: ListEnrichedType;
  getById: GetByIdType;
  getAgents: GetAgentsType;
  getTimeline: GetTimelineType;
  getPerpsPositions: GetPerpsPositionsType;
} = {
  listEnriched,
  getById,
  getAgents,
  getTimeline,
  getPerpsPositions,
};
