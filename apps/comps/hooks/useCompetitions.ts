import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { CompetitionsResponse, GetCompetitionsParams } from "@/types";

/**
 * Hook to fetch competitions with pagination and filtering
 * @param params Query parameters for competitions endpoint
 * @returns Query result with competitions data
 */
export const useCompetitions = (params: GetCompetitionsParams = {}) =>
  useQuery({
    queryKey: ["competitions", params],
    queryFn: async (): Promise<CompetitionsResponse> => {
      return apiClient.getCompetitions(params);
    },
    placeholderData: (prev) => prev,
  });
