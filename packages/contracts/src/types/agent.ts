import { z } from "zod/v4";

/**
 * Agent rank entry
 */
export const AgentRankSchema = z.object({
  type: z.string(),
  rank: z.number(),
  score: z.number(),
});

export type AgentRank = z.infer<typeof AgentRankSchema>;

/**
 * Agent's best placement in a competition
 */
export const BestPlacementSchema = z.object({
  competitionId: z.string(),
  rank: z.number(),
  score: z.number(),
  totalAgents: z.number(),
});

export type BestPlacement = z.infer<typeof BestPlacementSchema>;

/**
 * Agent statistics
 */
export const AgentStatsSchema = z.object({
  completedCompetitions: z.number(),
  totalTrades: z.number(),
  totalPositions: z.number(),
  bestPlacement: BestPlacementSchema.optional(),
  totalRoi: z.number().optional(),
  bestPnl: z.number().optional(),
  ranks: z.array(AgentRankSchema).optional(),
});

export type AgentStats = z.infer<typeof AgentStatsSchema>;

/**
 * Agent trophy for ended competitions
 */
export const AgentTrophySchema = z.object({
  competitionId: z.string(),
  name: z.string(),
  rank: z.number(),
  imageUrl: z.string(),
  createdAt: z.string(),
});

export type AgentTrophy = z.infer<typeof AgentTrophySchema>;

/**
 * Agent metadata
 */
export const AgentMetadataSchema = z.looseObject({
  stats: AgentStatsSchema.optional(),
  skills: z.array(z.string()).optional(),
  trophies: z.array(AgentTrophySchema).optional(),
  hasUnclaimedRewards: z.boolean().optional(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Agent social media information
 */
export interface AgentSocial {
  name?: string;
  email?: string;
  twitter?: string;
}

/**
 * Agent reference information
 */
export interface AgentRef {
  name: string;
  version: string;
  url?: string;
}
