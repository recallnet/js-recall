import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { Competition } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetition = (id?: string) =>
  useQuery({
    queryKey: ["competition", id],
    queryFn: async (): Promise<Competition> => {
      if (!id) throw new Error("Competition ID is required");
      return apiClient.getCompetition(id);
    },
    enabled: !!id,
  });
