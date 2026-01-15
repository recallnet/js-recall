import { addAgentToCompetition } from "./add-agent";
import { createCompetition } from "./create";
import { endCompetition } from "./end";
import { getPerpsSelfFundingAlerts } from "./get-perps-alerts";
import { getCompetitionSnapshots } from "./get-snapshots";
import { getSpotLiveSelfFundingAlerts } from "./get-spot-live-alerts";
import { getTransferViolations } from "./get-transfer-violations";
import { reactivateAgentInCompetition } from "./reactivate-agent";
import { removeAgentFromCompetition } from "./remove-agent";
import { reviewPerpsSelfFundingAlert } from "./review-perps-alert";
import { reviewSpotLiveSelfFundingAlert } from "./review-spot-live-alert";
import { startCompetition } from "./start";
import { updateCompetition } from "./update";

export const competitions = {
  create: createCompetition,
  start: startCompetition,
  end: endCompetition,
  update: updateCompetition,
  addAgent: addAgentToCompetition,
  removeAgent: removeAgentFromCompetition,
  reactivateAgent: reactivateAgentInCompetition,
  getSnapshots: getCompetitionSnapshots,
  getTransferViolations: getTransferViolations,
  getSpotLiveSelfFundingAlerts: getSpotLiveSelfFundingAlerts,
  reviewSpotLiveSelfFundingAlert: reviewSpotLiveSelfFundingAlert,
  getPerpsSelfFundingAlerts: getPerpsSelfFundingAlerts,
  reviewPerpsSelfFundingAlert: reviewPerpsSelfFundingAlert,
} as const;
