import { relations } from "drizzle-orm/relations";

import { agents, users } from "@/database/schema/core/defs.js";

import {
  epochs,
  rewards,
  rewardsRoots,
  rewardsTree,
  stakes,
  voteAssignments,
  votesAvailable,
  votesPerformed,
} from "./defs.js";

export const epochsRelations = relations(epochs, ({ many }) => ({
  stakes: many(stakes),
  voteAssignments: many(voteAssignments),
  votesAvailable: many(votesAvailable),
  votesPerformed: many(votesPerformed),
  rewards: many(rewards),
  rewardsTree: many(rewardsTree),
  rewardsRoots: many(rewardsRoots),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  votesPerformed: many(votesPerformed),
}));

export const stakesRelations = relations(stakes, ({ one, many }) => ({
  user: one(users, {
    fields: [stakes.userId],
    references: [users.id],
  }),
  epochCreated: one(epochs, {
    fields: [stakes.epochCreated],
    references: [epochs.id],
  }),
  voteAssignments: many(voteAssignments),
}));

export const voteAssignmentsRelations = relations(
  voteAssignments,
  ({ one }) => ({
    user: one(users, {
      fields: [voteAssignments.userId],
      references: [users.id],
    }),
    stake: one(stakes, {
      fields: [voteAssignments.stakeId],
      references: [stakes.id],
    }),
    epoch: one(epochs, {
      fields: [voteAssignments.epoch],
      references: [epochs.id],
    }),
  }),
);

export const votesAvailableRelations = relations(votesAvailable, ({ one }) => ({
  user: one(users, {
    fields: [votesAvailable.userId],
    references: [users.id],
  }),
  epoch: one(epochs, {
    fields: [votesAvailable.epoch],
    references: [epochs.id],
  }),
}));

export const votesPerformedRelations = relations(votesPerformed, ({ one }) => ({
  user: one(users, {
    fields: [votesPerformed.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [votesPerformed.agentId],
    references: [agents.id],
  }),
  epoch: one(epochs, {
    fields: [votesPerformed.epoch],
    references: [epochs.id],
  }),
}));

export const rewardsRelations = relations(rewards, ({ one }) => ({
  epoch: one(epochs, {
    fields: [rewards.epoch],
    references: [epochs.id],
  }),
}));

export const rewardsTreeRelations = relations(rewardsTree, ({ one }) => ({
  epoch: one(epochs, {
    fields: [rewardsTree.epoch],
    references: [epochs.id],
  }),
}));

export const rewardsRootsRelations = relations(rewardsRoots, ({ one }) => ({
  epoch: one(epochs, {
    fields: [rewardsRoots.epoch],
    references: [epochs.id],
  }),
}));
