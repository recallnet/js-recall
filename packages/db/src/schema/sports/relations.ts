import { relations } from "drizzle-orm/relations";

import { agents, competitions } from "../core/defs.js";
import {
  competitionAggregateScores,
  competitionGames,
  gamePlays,
  gamePredictionScores,
  gamePredictions,
  games,
} from "./defs.js";

export const gamesRelations = relations(games, ({ many }) => ({
  competitionGames: many(competitionGames),
  gamePlays: many(gamePlays),
  gamePredictions: many(gamePredictions),
  gamePredictionScores: many(gamePredictionScores),
}));

export const gamePlaysRelations = relations(gamePlays, ({ one }) => ({
  game: one(games, {
    fields: [gamePlays.gameId],
    references: [games.id],
  }),
}));

export const competitionGamesRelations = relations(
  competitionGames,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionGames.competitionId],
      references: [competitions.id],
    }),
    game: one(games, {
      fields: [competitionGames.gameId],
      references: [games.id],
    }),
  }),
);

export const gamePredictionsRelations = relations(
  gamePredictions,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [gamePredictions.competitionId],
      references: [competitions.id],
    }),
    game: one(games, {
      fields: [gamePredictions.gameId],
      references: [games.id],
    }),
    agent: one(agents, {
      fields: [gamePredictions.agentId],
      references: [agents.id],
    }),
  }),
);

export const gamePredictionScoresRelations = relations(
  gamePredictionScores,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [gamePredictionScores.competitionId],
      references: [competitions.id],
    }),
    game: one(games, {
      fields: [gamePredictionScores.gameId],
      references: [games.id],
    }),
    agent: one(agents, {
      fields: [gamePredictionScores.agentId],
      references: [agents.id],
    }),
  }),
);

export const competitionAggregateScoresRelations = relations(
  competitionAggregateScores,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionAggregateScores.competitionId],
      references: [competitions.id],
    }),
    agent: one(agents, {
      fields: [competitionAggregateScores.agentId],
      references: [agents.id],
    }),
  }),
);
