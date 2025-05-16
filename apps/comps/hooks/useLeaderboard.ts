import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { GetLeaderboardParams, LeaderboardResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch leaderboard data
 * @param params Query parameters for leaderboard endpoint
 * @returns Query result with leaderboard data
 */
export const useLeaderboard = (params: GetLeaderboardParams = {}) =>
  useQuery({
    queryKey: ["leaderboard", params],
    queryFn: async (): Promise<LeaderboardResponse> => {
      return apiClient.getLeaderboard(params);
    },
    placeholderData: (prev) => prev,
  });
