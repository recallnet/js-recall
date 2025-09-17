import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { CompetitionStatus, CompetitionTimelineResponse } from "@/types";

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @param status Competition status (optional) - will skip fetch if status is pending
 * @returns Query result with competition data
 */
export const useCompetitionTimeline = (
  id?: string,
  status?: CompetitionStatus,
) =>
  useQuery({
    queryKey: ["competition", "timeline", id],
    queryFn: async (): Promise<CompetitionTimelineResponse["timeline"]> => {
      if (!id) throw new Error("Competition ID is required");
      return (await apiClient.getCompetitionTimeline(id)).timeline;
    },
    enabled: !!id && status !== CompetitionStatus.Pending,
  });
