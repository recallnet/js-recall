import type { AgentPublic, AgentWithMetrics } from "@recallnet/services/types";

import { Agent } from "@/types";

/**
 * Extended agent type that includes fields added back in RPC handlers
 */
type ExtendedAgentFields = {
  email?: string | null;
  deactivationReason?: string | null;
  deactivationDate?: Date | null;
};

/**
 * Serialize base agent fields (common to both AgentPublic and AgentWithMetrics)
 * Converts null to undefined and Date objects to ISO strings
 */
function serializeAgentBase<T extends AgentPublic & ExtendedAgentFields>(
  agent: T,
) {
  return {
    id: agent.id,
    name: agent.name,
    handle: agent.handle,
    walletAddress: agent.walletAddress ?? undefined,
    isVerified: agent.isVerified,
    ownerId: agent.ownerId,
    imageUrl: agent.imageUrl ?? undefined,
    description: agent.description ?? undefined,
    email: agent.email ?? undefined,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    metadata: agent.metadata as Agent["metadata"],
    deactivationReason: agent.deactivationReason ?? undefined,
    deactivationDate: agent.deactivationDate?.toISOString(),
  };
}

/**
 * Serialize AgentPublic (without metrics) to frontend format
 * Used for createAgent and updateAgent responses
 */
export function serializeAgentPublic(
  agent: AgentPublic & ExtendedAgentFields,
): Omit<Agent, "stats" | "skills" | "trophies" | "hasUnclaimedRewards"> {
  return serializeAgentBase(agent);
}

/**
 * Serialize agent with metrics to frontend format
 * Used for getAgent and getAgents responses
 */
export function serializeAgent(
  agentWithMetrics: AgentWithMetrics & ExtendedAgentFields,
): Agent {
  return {
    ...serializeAgentBase(agentWithMetrics),
    stats: {
      bestPlacement: agentWithMetrics.stats.bestPlacement,
      bestPnl: agentWithMetrics.stats.bestPnl,
      totalVotes: agentWithMetrics.stats.totalVotes,
      totalTrades: agentWithMetrics.stats.totalTrades,
      completedCompetitions: agentWithMetrics.stats.completedCompetitions,
      score: agentWithMetrics.stats.score,
      totalRoi: agentWithMetrics.stats.totalRoi,
      rank: agentWithMetrics.stats.rank,
      totalPositions: agentWithMetrics.stats.totalPositions,
    },
    skills: agentWithMetrics.skills,
    trophies: agentWithMetrics.trophies,
    hasUnclaimedRewards: agentWithMetrics.hasUnclaimedRewards,
  };
}
