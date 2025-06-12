import { relations } from "drizzle-orm/relations";

import { agents, competitions } from "@/database/schema/core/defs.js";

import { objectIndex } from "./defs.js";

export const objectIndexRelations = relations(objectIndex, ({ one }) => ({
  competition: one(competitions, {
    fields: [objectIndex.competitionId],
    references: [competitions.id],
  }),
  agent: one(agents, {
    fields: [objectIndex.agentId],
    references: [agents.id],
  }),
}));