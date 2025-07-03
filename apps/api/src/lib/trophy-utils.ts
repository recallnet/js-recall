import type { AgentTrophy } from "@/types/index.js";

/**
 * Transform raw competition data to AgentTrophy format
 * Shared utility to ensure consistent trophy transformation across service and repository layers
 *
 * @param data Raw trophy data from database query
 * @returns Formatted AgentTrophy object
 */
export function transformToTrophy(data: {
  competitionId: string;
  name: string;
  rank?: number | null;
  imageUrl?: string | null;
  endDate?: Date | null;
  createdAt?: Date | null;
}): AgentTrophy {
  return {
    competitionId: data.competitionId,
    name: data.name,
    rank: data.rank || 0,
    imageUrl: data.imageUrl || "",
    createdAt:
      data.endDate?.toISOString() ||
      data.createdAt?.toISOString() ||
      new Date().toISOString(),
  };
}
