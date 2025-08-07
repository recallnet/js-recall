import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { CompetitionTimelineResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetitionTimeline = (id?: string) =>
  useQuery({
    queryKey: ["competition", "timeline", id],
    queryFn: async (): Promise<CompetitionTimelineResponse["timeline"]> => {
      if (!id) throw new Error("Competition ID is required");
      return (await apiClient.getCompetitionTimeline(id)).timeline;
    },
    enabled: !!id,
  });
