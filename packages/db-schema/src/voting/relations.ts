import { relations } from "drizzle-orm/relations";

import { competitions } from "../core/defs.js";
import { rewards, rewardsRoots, rewardsTree } from "./defs.js";

export const rewardsRelations = relations(rewards, ({ one }) => ({
  competition: one(competitions, {
    fields: [rewards.competitionId],
    references: [competitions.id],
  }),
}));

export const rewardsTreeRelations = relations(rewardsTree, ({ one }) => ({
  competition: one(competitions, {
    fields: [rewardsTree.competitionId],
    references: [competitions.id],
  }),
}));

export const rewardsRootsRelations = relations(rewardsRoots, ({ one }) => ({
  competition: one(competitions, {
    fields: [rewardsRoots.competitionId],
    references: [competitions.id],
  }),
}));
