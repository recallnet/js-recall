import { addAgentToCompetition } from "./add-agent";
import { createCompetition } from "./create";
import { endCompetition } from "./end";
import { removeAgentFromCompetition } from "./remove-agent";
import { startCompetition } from "./start";
import { updateCompetition } from "./update";

export const competitions = {
  create: createCompetition,
  start: startCompetition,
  end: endCompetition,
  update: updateCompetition,
  addAgent: addAgentToCompetition,
  removeAgent: removeAgentFromCompetition,
} as const;
