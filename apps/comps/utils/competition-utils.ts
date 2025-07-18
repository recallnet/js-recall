import { CheckIcon, ClockIcon, Play } from "lucide-react";

import { Competition, CompetitionStatus, UserCompetition } from "@/types";

import { formatDate } from "./format";

export const STATUS_ICONS = {
  [CompetitionStatus.Active]: Play,
  [CompetitionStatus.Pending]: ClockIcon,
  [CompetitionStatus.Ended]: CheckIcon,
} as const;

/**
 * Formats the start and end dates of a competition in a user-friendly abbreviated form (MM/dd).
 * If either date is missing it falls back to the string "TBA".
 *
 * @example
 * ```ts
 * formatCompetitionDates("2024-08-01T00:00:00Z", undefined); // "08/01 - TBA"
 * ```
 */
export function formatCompetitionDates(
  startDate?: Date | number | string | null,
  endDate?: Date | number | string | null,
): string {
  const start = startDate ? formatDate(new Date(startDate)) : "TBA";
  const end = endDate ? formatDate(new Date(endDate)) : "TBA";

  return `${start} - ${end}`;
}

/**
 * Merges a list of competitions with user competitions data to create a list of competitions
 * with their associated agents.
 *
 * @param competitions - List of competitions to merge
 * @param userCompetitions - List of user competitions containing agent data
 * @returns List of competitions with their associated agents
 */
export function mergeCompetitionsWithUserData(
  competitions: Competition[],
  userCompetitions: UserCompetition[],
): UserCompetition[] {
  return competitions.map((competition) => {
    const userCompetition = userCompetitions.find(
      (uc) => uc.id === competition.id,
    );

    return {
      ...competition,
      agents: userCompetition?.agents ?? [],
    };
  });
}
