import {useQuery} from "@tanstack/react-query";

import {ApiClient} from "@/lib/api-client";
import {CompetitionPerformanceResponse} from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetitionPerformance = (id?: string) =>
  useQuery({
    queryKey: ["competition", "performance", id],
    queryFn: async (): Promise<CompetitionPerformanceResponse['performance']> => {
      if (!id) throw new Error("Competition ID is required");
      return (await apiClient.getCompetitionPerformance(id)).performance
    },
    enabled: !!id,
  });
