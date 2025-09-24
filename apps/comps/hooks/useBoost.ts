import type * as _A from "@orpc/contract";
import {
  UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { apiClient } from "@/lib/api-client";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

export const useBoostBalance = (competitionId: string) => {
  const { isAuthenticated } = useSession();
  return useQuery(
    tanstackClient.boost.balance.queryOptions({
      input: { competitionId },
      enabled: isAuthenticated,
    }),
  );
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

export const useBoostTotals = (competitionId: string) => {
  return useQuery({
    queryKey: ["boostTotals", competitionId],
    queryFn: async () => {
      try {
        const res = await apiClient.getAgentBoostTotals({ competitionId });
        if (!res.success) throw new Error("Error when fetching boost totals");
        return res;
      } catch (error) {
        throw error;
      }
    },
  });
};

type BoostAgentParams = Parameters<typeof apiClient.boostAgent>[0];
type BoostAgentResponse = Awaited<ReturnType<typeof apiClient.boostAgent>>;

export const useBoostAgent = (
  options?: Omit<
    UseMutationOptions<BoostAgentResponse, Error, BoostAgentParams, unknown>,
    "mutationFn"
  >,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (params: Parameters<typeof apiClient.boostAgent>[0]) => {
      return apiClient.boostAgent(params);
    },
    onSuccess: (data, variables, context) => {
      options?.onSuccess?.(data, variables, context);
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["boostTotals", variables.competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["boosts", variables.competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["boostBalance", variables.competitionId],
      });
    },
  });
};
