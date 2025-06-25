import { useSuspenseQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { CompetitionResponse } from "@/types";

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetition = (id: string) =>
  useSuspenseQuery({
    queryKey: ["competition", id],
    queryFn: async (): Promise<CompetitionResponse["competition"]> => {
      return (await apiClient.getCompetition(id)).competition;
    },
  });
