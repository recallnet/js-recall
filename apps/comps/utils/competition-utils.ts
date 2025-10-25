import { CheckIcon, ClockIcon, Play } from "lucide-react";

import { RouterOutputs } from "@/rpc/router";
import { UserCompetition } from "@/types";

import { formatDate } from "./format";

export function iconForStatus(
  status: RouterOutputs["competitions"]["getById"]["status"],
) {
  switch (status) {
    case "active":
      return Play;
    case "pending":
      return ClockIcon;
    case "ending":
    case "ended":
      return CheckIcon;
  }
}

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
  competitions: RouterOutputs["competitions"]["list"]["competitions"],
  userCompetitions: UserCompetition[],
) {
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

/**
 * Formats a competition type for display in the UI.
 * Maps internal competition types to user-friendly display names.
 *
 * @param type - The raw competition type from the API
 * @returns The formatted display name for the competition type
 *
 * @example
 * ```ts
 * formatCompetitionType("trading"); // "Crypto Trading"
 * formatCompetitionType("perpetual_futures"); // "Perpetual Futures"
 * formatCompetitionType("unknown"); // "unknown"
 * ```
 */
export function formatCompetitionType(type: string): string {
  const typeMap: Record<string, string> = {
    trading: "Crypto Trading",
    perpetual_futures: "Perpetual Futures",
  };

  return typeMap[type] || type;
}

/**
 * Gets the skills for a competition type.
 * All competitions include "Crypto Trading" as a base skill.
 * Perpetual futures competitions also include "Perpetual Futures" and "Live Trading" as additional skills.
 *
 * @param type - The raw competition type from the API
 * @returns An array of skills for the competition
 *
 * @example
 * ```ts
 * getCompetitionSkills("trading"); // ["Crypto Trading"]
 * getCompetitionSkills("perpetual_futures"); // ["Crypto Trading", "Perpetual Futures", "Live Trading"]
 * ```
 */
export function getCompetitionSkills(type: string): string[] {
  const baseSkills = ["Crypto Trading"];

  if (type === "perpetual_futures") {
    return [...baseSkills, "Perpetual Futures", "Live Trading"];
  }

  return baseSkills;
}

/**
 * Checks if a skill is an agent skill.
 * @param skill - The skill to check
 * @returns True if the skill is an agent skill, false otherwise
 */
export function checkIsAgentSkill(skill: string): boolean {
  return skill === "trading" || skill === "perpetual_futures";
}

export function checkIsPerpsCompetition(
  type: RouterOutputs["competitions"]["getById"]["type"],
): boolean {
  return type === "perpetual_futures";
}
