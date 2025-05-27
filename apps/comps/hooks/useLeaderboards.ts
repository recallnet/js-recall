import {useQuery} from "@tanstack/react-query";

import {ApiClient} from "@/lib/api-client";
import {GetLeaderboardParams, LeaderboardResponse} from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch leaderboards data
 * @param params Query parameters for leaderboard endpoint
 * @returns Query result with leaderboard data
 */
export const useLeaderboards = (params: GetLeaderboardParams = {}) =>
  useQuery({
    queryKey: ["leaderboards", params],
    queryFn: async (): Promise<LeaderboardResponse> => {
      return apiClient.getLeaderboards(params);
    },
    placeholderData: (prev) => prev,
  });
