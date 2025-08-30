import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { AgentCompetitionResponse, GetCompetitionAgentsParams } from "@/types";

/**
 * Hook to fetch agents participating in a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition agents endpoint
 * @returns Query result with agents data
 */
export const useCompetitionAgents = (
  competitionId?: string,
  params: GetCompetitionAgentsParams = {},
) =>
  useQuery({
    queryKey: ["competition-agents", competitionId, params],
    queryFn: async (): Promise<AgentCompetitionResponse> => {
      if (!competitionId) throw new Error("Competition ID is required");
      const response = await apiClient.getCompetitionAgents(
        competitionId,
        params,
      );

      // Add placeholder userVotes data to each agent
      // Only some agents have votes from the user
      const agentsWithUserVotes = response.agents.map((agent) => ({
        ...agent,
        userVotes:
          Math.random() > 0.6 ? Math.floor(Math.random() * 50) + 1 : undefined,
      }));

      return {
        ...response,
        agents: agentsWithUserVotes,
      };
    },
    enabled: !!competitionId,
    placeholderData: (prev) => prev,
  });
