import { useQuery } from "@tanstack/react-query";

import { BenchmarkLeaderboardPayload } from "@/types/unified-leaderboard";

/**
 * Hook to fetch benchmark leaderboard data from static JSON
 * This data contains AI model performance across multiple skills
 */
export const useBenchmarkLeaderboard = () => {
  return useQuery({
    queryKey: ["benchmark-leaderboard"],
    queryFn: async (): Promise<BenchmarkLeaderboardPayload> => {
      const response = await fetch("/data/benchmark-leaderboard.json");

      if (!response.ok) {
        throw new Error("Failed to fetch benchmark leaderboard data");
      }

      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour (static data changes infrequently)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours (was cacheTime in older versions)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook to get a specific skill's data from the benchmark payload
 */
export const useBenchmarkSkill = (skillId: string) => {
  const { data: benchmarkData, ...rest } = useBenchmarkLeaderboard();

  return {
    ...rest,
    data: benchmarkData
      ? {
          skill: benchmarkData.skills[skillId],
          models: benchmarkData.models
            .filter((model) => model.scores[skillId] !== undefined)
            .sort(
              (a, b) =>
                (a.scores[skillId]?.rank || 999) -
                (b.scores[skillId]?.rank || 999),
            ),
          stats: benchmarkData.skillStats[skillId],
        }
      : undefined,
  };
};

/**
 * Hook to get available benchmark skills
 */
export const useBenchmarkSkills = () => {
  const { data: benchmarkData, ...rest } = useBenchmarkLeaderboard();

  return {
    ...rest,
    data: benchmarkData
      ? Object.values(benchmarkData.skills)
          .filter((skill) => skill.isEnabled)
          .sort((a, b) => a.displayOrder - b.displayOrder)
      : undefined,
  };
};
