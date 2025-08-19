import { useQuery } from "@tanstack/react-query";

import {
  SkillDefinition,
  UnifiedLeaderboardData,
  UnifiedRankingEntry,
  UnifiedSkillData,
} from "@/types/leaderboard";

import { useBenchmarkLeaderboard } from "./useBenchmarkLeaderboard";
import { useLeaderboards } from "./useLeaderboards";

/**
 * Hook to get unified leaderboard data combining benchmark models + trading agents
 */
export const useUnifiedLeaderboard = () => {
  const benchmarkQuery = useBenchmarkLeaderboard();
  const tradingQuery = useLeaderboards({ type: "trading", limit: 100 });

  return useQuery({
    queryKey: ["unified-leaderboard"],
    queryFn: async (): Promise<UnifiedLeaderboardData> => {
      if (!benchmarkQuery.data) {
        throw new Error("Benchmark data not loaded");
      }

      // Create trading skill definition
      const tradingSkill: SkillDefinition = {
        id: "7d-pnl",
        name: "Trading Rankings",
        description:
          "Agent skill rankings based on trading competition performance",
        longDescription:
          "This ranking system evaluates AI agents based on their cumulative performance across trading competitions. Scores are calculated using a skill-based rating system that considers placement and performance relative to other agents.",
        category: "trading",
        displayOrder: 0, // Show first
        isEnabled: true,
        methodology:
          "Rankings use an ELO-like rating system that updates after each competition. Agents gain or lose rating points based on their relative performance against other participants. Starting agents begin with a default rating, and points are redistributed based on final placement using the PlackettLuce model.",

        researchLinks: [
          {
            title: "OpenSkill: Multiplayer Rating System",
            url: "https://github.com/philihp/openskill.js",
          },
          {
            title: "PlackettLuce Model for Ranking",
            url: "https://en.wikipedia.org/wiki/Plackett%E2%80%93Luce_model",
          },
        ],
      };

      // Combine all skills
      const allSkills = {
        "7d-pnl": tradingSkill,
        ...benchmarkQuery.data.skills,
      };

      // Process trading skill data
      const tradingSkillData: UnifiedSkillData = {
        skill: tradingSkill,
        participants: {
          models: [], // No models in trading
          agents: tradingQuery.data?.agents || [],
        },
        stats: {
          totalParticipants: tradingQuery.data?.agents.length || 0,
          modelCount: 0,
          agentCount: tradingQuery.data?.agents.length || 0,
          avgScore:
            tradingQuery.data?.agents && tradingQuery.data.agents.length > 0
              ? tradingQuery.data.agents.reduce(
                  (sum, agent) => sum + agent.score,
                  0,
                ) / tradingQuery.data.agents.length
              : 0,
          topScore:
            tradingQuery.data?.agents && tradingQuery.data.agents.length > 0
              ? Math.max(...tradingQuery.data.agents.map((a) => a.score))
              : 0,
        },
      };

      // Process benchmark skill data
      const benchmarkSkillData: Record<string, UnifiedSkillData> = {};

      Object.entries(benchmarkQuery.data.skills).forEach(([skillId, skill]) => {
        const modelsForSkill = benchmarkQuery
          .data!.models.filter((model) => model.scores[skillId] !== undefined)
          .sort(
            (a, b) =>
              (a.scores[skillId]?.rank || 999) -
              (b.scores[skillId]?.rank || 999),
          );

        benchmarkSkillData[skillId] = {
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
      });

      return {
        skills: allSkills,
        skillData: {
          "7d-pnl": tradingSkillData,
          ...benchmarkSkillData,
        },
        globalStats: {
          totalSkills: Object.keys(allSkills).length,
          totalModels: benchmarkQuery.data.models.length,
          totalAgents: tradingQuery.data?.agents.length || 0,
        },
      };
    },
    enabled: benchmarkQuery.isSuccess && tradingQuery.isSuccess, // Wait for both data sources
    staleTime: 2 * 60 * 1000, // 2 minutes (trading data changes frequently)
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
      imageUrl: agent.imageUrl,
      additionalMetrics: {
        trades: agent.numCompetitions, // Using available data
        competitions: agent.numCompetitions,
      },
    });
  });

  // Sort by rank
  return rankings.sort((a, b) => a.rank - b.rank);
}
