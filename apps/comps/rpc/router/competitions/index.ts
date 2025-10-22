import { GetAgentsType, getAgents } from "./get-agents";
import { GetByIdType, getById } from "./get-by-id";
import {
  GetPerpsPositionsType,
  getPerpsPositions,
} from "./get-perps-positions";
import { GetRulesType, getRules } from "./get-rules";
import { GetTimelineType, getTimeline } from "./get-timeline";
import { GetTradesType, getTrades } from "./get-trades";
import { JoinType, join } from "./join";
import { LeaveType, leave } from "./leave";
import { ListType, list } from "./list";

export const router: {
  list: ListType;
  getById: GetByIdType;
  getAgents: GetAgentsType;
  getTimeline: GetTimelineType;
  getTrades: GetTradesType;
  getPerpsPositions: GetPerpsPositionsType;
  join: JoinType;
  leave: LeaveType;
  getRules: GetRulesType;
} = {
  list,
  getById,
  getAgents,
  getTimeline,
  getTrades,
  getPerpsPositions,
  join,
  leave,
  getRules,
};
