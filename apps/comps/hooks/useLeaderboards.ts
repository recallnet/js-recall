import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { GetLeaderboardParams, LeaderboardResponse } from "@/types";

/**
 * Hook to fetch leaderboards data
 * @param params Query parameters for leaderboard endpoint
 * @returns Query result with leaderboard data
 */
export const useLeaderboards = (params: GetLeaderboardParams = {}) =>
  useQuery({
    queryKey: ["leaderboards", params],
    queryFn: async (): Promise<LeaderboardResponse> => {
      return apiClient.getGlobalLeaderboard(params);
    },
    enabled: params.enabled !== false,
    placeholderData: (prev) => prev,
  });
