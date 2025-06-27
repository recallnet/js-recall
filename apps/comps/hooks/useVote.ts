import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient, UnauthorizedError } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import {
  CreateVoteRequest,
  EnrichedVotesResponse,
  GetVotesParams,
  VotesResponse,
  VotingStateResponse,
} from "@/types/vote";

import { useClientCleanup } from "./useAuth";

const apiClient = new ApiClient();

/**
 * Hook to create a vote
 * @returns Mutation for creating a vote
 */
export const useVote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVoteRequest) => {
      return apiClient.createVote(data);
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["votes"] });
      queryClient.invalidateQueries({
        queryKey: ["competition-agents", variables.competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["competition", variables.competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["votingState", variables.competitionId],
      });
    },
  });
};

/**
 * Hook to fetch user votes
 * @param params - Query parameters
 * @returns Query result with votes data
 */
export const useVotes = (params: GetVotesParams = {}) => {
  const { status } = useUser();
  const cleanup = useClientCleanup();

  return useQuery({
    queryKey: ["votes", params],
    queryFn: async (): Promise<VotesResponse> => {
      try {
        const res = await apiClient.getVotes(params);
        if (!res.success) throw new Error("Error when fetching votes");
        return res;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          cleanup();
        }
        throw error;
      }
    },
    enabled: status === "authenticated",
  });
};

/**
 * Hook to fetch user votes with agent and competition data
 * @param params - Query parameters
 * @returns Query result with votes data
 */
export const useEnrichedVotes = (params: GetVotesParams = {}) => {
  const { status } = useUser();
  const cleanup = useClientCleanup();

  return useQuery({
    queryKey: ["enriched-votes", params],
    queryFn: async (): Promise<EnrichedVotesResponse> => {
      try {
        const res = await apiClient.getEnrichedVotes(params);
        if (!res.success) throw new Error("Error when fetching votes");
        return res;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          cleanup();
        }
        throw error;
      }
    },
    enabled: status === "authenticated",
  });
};

/**
 * Hook to fetch voting state for a competition
 * @param competitionId - Competition ID
 * @returns Query result with voting state
 */
export const useVotingState = (competitionId: string) => {
  const { status } = useUser();
  const cleanup = useClientCleanup();

  return useQuery({
    queryKey: ["votingState", competitionId],
    queryFn: async (): Promise<VotingStateResponse> => {
      try {
        const res = await apiClient.getVotingState(competitionId);
        if (!res.success) throw new Error("Error when fetching voting state");
        return res;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          cleanup();
        }
        throw error;
      }
    },
    enabled: status === "authenticated" && !!competitionId,
  });
};
