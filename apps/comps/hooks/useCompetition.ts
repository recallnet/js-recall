import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { CompetitionResponse } from "@/types";

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetition = (id?: string) =>
  useQuery({
    queryKey: ["competition", id],
    queryFn: async (): Promise<CompetitionResponse["competition"]> => {
      if (!id) throw new Error("Competition ID is required");
      return (await apiClient.getCompetition(id)).competition;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds - shorter cache for real-time voting updates
    refetchInterval: 60 * 1000, // Refetch every minute to keep data fresh
  });
