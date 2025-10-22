import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { CompetitionStatus } from "@recallnet/services/types";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { GetAgentCompetitionsParams } from "@/types";

/**
 * Hook to fetch competitions for a specific agent
 * @param agentId Agent ID
 * @param params Query parameters for agent competitions endpoint
 * @returns Query result with competitions data
 */
export const useAgentCompetitions = (
  agentId?: string,
  params: GetAgentCompetitionsParams = {},
): UseQueryResult<RouterOutputs["agent"]["getCompetitions"], Error> => {
  const { status, claimed, sort, limit = 10, offset = 0 } = params;

  return useQuery(
    tanstackClient.agent.getCompetitions.queryOptions({
      input: agentId
        ? {
            agentId,
            filters: {
              status: status as CompetitionStatus | undefined,
              claimed,
            },
            paging: {
              sort,
              limit,
              offset,
            },
          }
        : skipToken,
      placeholderData: (prev) => prev,
    }),
  );
};

export type AgentCompetitionsResult = RouterOutputs["agent"]["getCompetitions"];
