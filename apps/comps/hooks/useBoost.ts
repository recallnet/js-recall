import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { apiClient } from "@/lib/api-client";

export const useBoostBalance = (competitionId: string) => {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: ["boostBalance", competitionId],
    queryFn: async () => {
      try {
        const res = await apiClient.getBoostBalance({ competitionId });
        if (!res.success) throw new Error("Error when fetching boost balance");
        return res;
      } catch (error) {
        throw error;
      }
    },
    enabled: isAuthenticated,
  });
};

export const useBoosts = (competitionId: string) => {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: ["boosts", competitionId],
    queryFn: async () => {
      try {
        const res = await apiClient.getBoosts({ competitionId });
        if (!res.success) throw new Error("Error when fetching boosts");
        return res;
      } catch (error) {
        throw error;
      }
    },
    enabled: isAuthenticated,
  });
};

export const useBoostAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Parameters<typeof apiClient.boostAgent>[0]) => {
      return apiClient.boostAgent(params);
    },
    onSuccess: (_, { competitionId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["boosts", competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["boostBalance", competitionId],
      });
    },
  });
};
