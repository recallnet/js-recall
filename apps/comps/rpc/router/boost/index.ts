import { agentBoostTotals } from "./agent-boost-totals";
import { availableAwards } from "./available-awards";
import { balance } from "./balance";
import { boostAgent } from "./boost-agent";
import { claimStakedBoost } from "./claim-staked-boost";
import { competitionBoosts } from "./competition-boosts";
import { userBonusBoosts } from "./user-bonus-boosts";
import { userBoosts } from "./user-boosts";

export const router = {
  claimStakedBoost,
  agentBoostTotals,
  balance,
  boostAgent,
  userBoosts,
  userBonusBoosts,
  availableAwards,
  competitionBoosts,
};
