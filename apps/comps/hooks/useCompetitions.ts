import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { UnauthorizedError, apiClient } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import {
  CompetitionsResponse,
  GetCompetitionsParams,
  UserCompetitionsResponse,
} from "@/types";

/**
 * Hook to fetch competitions with pagination and filtering
 * @param params Query parameters for competitions endpoint
 * @returns Query result with competitions data
 */
export const useCompetitions = (params: GetCompetitionsParams = {}) =>
  useSuspenseQuery({
    queryKey: ["competitions", params],
    queryFn: async (): Promise<CompetitionsResponse> => {
      return apiClient.getCompetitions(params);
    },
  });

/**
 * Hook to fetch authenticated user's competitions
 * @param params Query parameters for user competitions endpoint
 * @returns Query result with user's competitions data
 */
export const useUserCompetitions = (params: GetCompetitionsParams = {}) => {
  const { status } = useUser();

  return useQuery({
    queryKey: ["user-competitions", params],
    queryFn: async (): Promise<UserCompetitionsResponse> => {
      return apiClient.getUserCompetitions(params);
    },
    enabled: status === "authenticated",
  });
};
