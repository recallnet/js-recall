import { agentBoostTotals } from "./agent-boost-totals";
import { availableAwards } from "./available-awards";
import { balance } from "./balance";
import { boostAgent } from "./boost-agent";
import { claimBoost } from "./claim-boost";
import { claimStakedBoost } from "./claim-staked-boost";
import { competitionBoosts } from "./competition-boosts";
import { userBoosts } from "./user-boosts";

export const router = {
  claimBoost,
  claimStakedBoost,
  agentBoostTotals,
  balance,
  boostAgent,
  userBoosts,
  availableAwards,
  competitionBoosts,
};
