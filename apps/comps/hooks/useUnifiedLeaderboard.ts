import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";
import { LeaderboardAgent } from "@/types/agent";
import {
  UnifiedLeaderboardData,
  UnifiedRankingEntry,
  UnifiedSkillData,
} from "@/types/leaderboard";

import { useBenchmarkLeaderboard } from "./useBenchmarkLeaderboard";

/**
 * Calculate summary scores for a list of agents.Note: this only considers the agents within the
 * results, and not a "global" calculation
 * @param agents - List of agents
 * @returns Object containing average and top score
 *
 */
function calculateSummaryScores(agents: LeaderboardAgent[]): {
  avgScore: number;
  topScore: number;
} {
  if (agents.length === 0) {
    return {
      avgScore: 0,
      topScore: 0,
    };
  }
  return {
    avgScore:
      agents.reduce((acc, agent) => acc + agent.score, 0) / agents.length,
    topScore: Math.max(...agents.map((agent) => agent.score)),
  };
}

/**
 * Hook to get unified leaderboard data combining benchmark models + trading agents
 */
export const useUnifiedLeaderboard = () => {
  const benchmarkQuery = useBenchmarkLeaderboard();

  return useQuery({
    queryKey: ["unified-leaderboard"],
    queryFn: async (): Promise<UnifiedLeaderboardData> => {
      if (!benchmarkQuery.data) {
        throw new Error("Benchmark data not loaded");
      }

      // All skills are now in the JSON, including trading
      const allSkills = benchmarkQuery.data.skills;

      // Process skill data
      const skillDataMap: Record<string, UnifiedSkillData> = {};

      // Process each skill
      for (const [skillId, skill] of Object.entries(allSkills)) {
        if (skillId === "crypto_trading") {
          // TODO: the `calculateSummaryScores` takes only the paginated results into account.
          // If we ever paginate these results, we'll need the API itself to return the avg &
          // max score. These are probably useful, too.
          // See: https://linear.app/recall-labs/issue/APP-553/add-new-stats-to-global-leaderboard-endpoint-average-and-max-score
          const agentsResponse = await client.leaderboard.getGlobal({
            type: "trading",
            limit: 100,
            offset: 0,
          });

          const { avgScore, topScore } = calculateSummaryScores(
            agentsResponse.agents,
          );

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: [], // No models in trading
              agents: agentsResponse.agents || [],
            },
            stats: {
              totalParticipants: agentsResponse.pagination?.total || 0, // Use total from API
              modelCount: 0,
              agentCount: agentsResponse.pagination?.total || 0, // Use total from API
              avgScore,
              topScore,
            },
            // Store pagination info for potential use
            pagination: agentsResponse.pagination,
          };
        } else if (skillId === "perpetual_futures") {
          // TODO: the `calculateSummaryScores` takes only the paginated results into account.
          // If we ever paginate these results, we'll need the API itself to return the avg &
          // max score. These are probably useful, too.
          // See: https://linear.app/recall-labs/issue/APP-553/add-new-stats-to-global-leaderboard-endpoint-average-and-max-score
          const agentsResponse = await client.leaderboard.getGlobal({
            type: "perpetual_futures",
            limit: 100,
            offset: 0,
          });

          const { avgScore, topScore } = calculateSummaryScores(
            agentsResponse.agents,
          );

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: [], // No models in trading
              agents: agentsResponse.agents || [],
            },
            stats: {
              totalParticipants: agentsResponse.pagination?.total || 0, // Use total from API
              modelCount: 0,
              agentCount: agentsResponse.pagination?.total || 0, // Use total from API
              avgScore,
              topScore,
            },
            // Store pagination info for potential use
            pagination: agentsResponse.pagination,
          };
        } else {
          // Benchmark skill - use models from JSON
          const modelsForSkill = benchmarkQuery
            .data!.models.filter((model) => model.scores[skillId] !== undefined)
            .sort(
              (a, b) =>
                (a.scores[skillId]?.rank || 999) -
                (b.scores[skillId]?.rank || 999),
            );

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: modelsForSkill,
              agents: [], // No agents in benchmark skills
            },
            stats: {
              totalParticipants: modelsForSkill.length,
              modelCount: modelsForSkill.length,
              agentCount: 0,
              avgScore: benchmarkQuery.data?.skillStats[skillId]?.avgScore,
              topScore: benchmarkQuery.data?.skillStats[skillId]?.topScore,
            },
          };
        }
      }

      // Calculate total agents from the API pagination data (shows full count)
      const totalAgents = skillDataMap.crypto_trading?.stats?.agentCount || 0;

      return {
        skills: allSkills,
        skillData: skillDataMap,
        globalStats: {
          totalSkills: Object.keys(allSkills).length,
          totalModels: benchmarkQuery.data.models.length,
          totalAgents: totalAgents,
        },
      };
    },
    enabled: benchmarkQuery.isSuccess, // Only wait for benchmark data (which now includes agents)
    staleTime: 5 * 60 * 1000, // 5 minutes (static data changes less frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get data for a specific skill (either benchmark or trading)
 */
export const useUnifiedSkillData = (skillId: string) => {
  const unifiedQuery = useUnifiedLeaderboard();

  return {
    ...unifiedQuery,
    data: unifiedQuery.data?.skillData[skillId],
  };
};

/**
 * Hook to get unified ranking entries for a specific skill
 * Converts both models and agents into a common format
 */
export const useSkillRankings = (skillId: string) => {
  const { data: skillData, ...rest } = useUnifiedSkillData(skillId);

  return {
    ...rest,
    data: skillData ? createUnifiedRankings(skillData, skillId) : undefined,
  };
};

/**
 * Helper function to create unified ranking entries
 */
function createUnifiedRankings(
  skillData: UnifiedSkillData,
  skillId: string,
): UnifiedRankingEntry[] {
  const rankings: UnifiedRankingEntry[] = [];

  // Add model rankings
  skillData.participants.models.forEach((model) => {
    const score = model.scores[skillId];
    if (score) {
      rankings.push({
        id: model.id,
        name: model.name,
        type: "model",
        rank: score.rank,
        score: score.rawScore,
        provider: model.provider,
        metadata: model, // Full model object since metadata is now flattened
      });
    }
  });

  // Add agent rankings
  skillData.participants.agents.forEach((agent) => {
    rankings.push({
      id: agent.id,
      name: agent.name,
      type: "agent",
      rank: agent.rank,
      score: agent.score,
      imageUrl: agent.imageUrl ?? undefined,
      additionalMetrics: {
        trades: agent.numCompetitions, // Using available data
        competitions: agent.numCompetitions,
      },
    });
  });

  // Sort by rank
  return rankings.sort((a, b) => a.rank - b.rank);
}
