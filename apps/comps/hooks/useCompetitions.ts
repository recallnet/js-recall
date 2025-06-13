import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import {
  CompetitionsResponse,
  GetCompetitionsParams,
  UserCompetitionsResponse,
} from "@/types";

const apiClient = new ApiClient();

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
    placeholderData: (prev) => prev,
  });
};
