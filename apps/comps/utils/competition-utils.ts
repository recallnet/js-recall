import { CheckIcon, ClockIcon, Play } from "lucide-react";

import { RouterOutputs } from "@/rpc/router";
import { EvaluationMetric, UserCompetition } from "@/types";

import { formatDateShort } from "./format";

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
 * Calculates polling interval with jitter for competition data
 * Returns an interval for active, pending, and ending competitions to keep data fresh.
 * Returns false for ended competitions to save resources.
 *
 * Polling interval matches backend cron job (perps) frequency (60s) with additional buffer
 * to allow time for processing (perps data sync, risk metrics calculation).
 *
 * @param status - Competition status
 * @returns Polling interval in milliseconds with jitter (60-65s), or false if ended
 */
export function getCompetitionPollingInterval(
  status: "active" | "pending" | "ending" | "ended" | undefined,
): number | false {
  if (status === "active" || status === "pending" || status === "ending") {
    // 60-65 second interval with jitter to prevent thundering herd
    // Matches backend cron frequency and allows time for processing
    return 60000 + Math.random() * 5000;
  }
  // No polling for ended competitions
  return false;
}

/**
 * Metric tab configuration for perps competitions
 * Single source of truth for metric display names, tab values, and ordering
 */
export const PERPS_METRIC_TABS = [
  {
    metric: "simple_return" as const,
    value: "account-value",
    label: "ROI",
  },
  {
    metric: "calmar_ratio" as const,
    value: "calmar-ratio",
    label: "Calmar Ratio",
  },
  {
    metric: "max_drawdown" as const,
    value: "max-drawdown",
    label: "Max Drawdown",
  },
  {
    metric: "sortino_ratio" as const,
    value: "sortino-ratio",
    label: "Sortino Ratio",
  },
] as const;

/**
 * Maps evaluation metric to display name
 * @param metric - Evaluation metric enum value
 * @returns Human-readable display name
 */
export function getEvaluationMetricDisplayName(
  metric: EvaluationMetric | undefined,
): string {
  const tab = PERPS_METRIC_TABS.find((t) => t.metric === metric);
  return tab?.label ?? "ROI";
}

/**
 * Maps evaluation metric to chart tab value
 * @param metric - Evaluation metric enum value
 * @returns Tab value string used in the timeline chart
 */
export function getEvaluationMetricTabValue(
  metric: EvaluationMetric | undefined,
): string {
  const tab = PERPS_METRIC_TABS.find((t) => t.metric === metric);
  return tab?.value ?? "account-value";
}

/**
 * Checks if a table header is the primary metric.
 * @param headerId - Table header ID string
 * @param metric - Evaluation metric enum value
 * @returns True if the table header is the primary metric, false otherwise
 */
export function checkTableHeaderIsPrimaryMetric(
  headerId: string,
  metric: EvaluationMetric | undefined,
): boolean {
  if (!metric) return false;
  const toSnakeCase = (str: string) =>
    str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return (
    toSnakeCase(headerId) ===
    PERPS_METRIC_TABS.find((t) => t.metric === metric)?.metric
  );
}

/**
 * Type for metric tab configuration
 */
export type MetricTab = {
  metric: EvaluationMetric;
  value: string;
  label: string;
};

/**
 * Gets ordered metric tabs with primary metric first
 * @param primaryMetric - The evaluation metric to place first
 * @returns Ordered array of tab configurations
 */
export function getOrderedMetricTabs(
  primaryMetric: EvaluationMetric | undefined,
): readonly MetricTab[] {
  if (!primaryMetric) return PERPS_METRIC_TABS;

  const primaryTab = PERPS_METRIC_TABS.find((t) => t.metric === primaryMetric);
  const otherTabs = PERPS_METRIC_TABS.filter((t) => t.metric !== primaryMetric);

  return primaryTab ? [primaryTab, ...otherTabs] : PERPS_METRIC_TABS;
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
  includeTime: boolean = false,
): string {
  const start = startDate
    ? formatDateShort(new Date(startDate), includeTime)
    : "TBA";
  const end = endDate ? formatDateShort(new Date(endDate), includeTime) : "TBA";

  return `${start} - ${end}`;
}

/**
 * Merges a list of competitions with user competitions data to create a list of competitions
 * with their associated agents.
 *
 * @param competitions - List of competitions from competitions endpoint
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
    spot_live_trading: "Spot Live Trading",
  };

  return typeMap[type] || type;
}

/**
 * Gets the skills for a competition type.
 * All competitions include "Crypto Trading" as a base skill.
 * Live trading competitions (perpetual futures and spot live) include "Live Trading" as an additional skill.
 * Perpetual futures competitions also include "Perpetual Futures" as a specialized skill.
 *
 * @param type - The raw competition type from the API
 * @returns An array of skills for the competition
 *
 * @example
 * ```ts
 * getCompetitionSkills("trading"); // ["Crypto Trading"]
 * getCompetitionSkills("perpetual_futures"); // ["Crypto Trading", "Perpetual Futures", "Live Trading"]
 * getCompetitionSkills("spot_live_trading"); // ["Crypto Trading", "Live Trading"]
 * ```
 */
export function getCompetitionSkills(type: string): string[] {
  const baseSkills = ["Crypto Trading"];

  if (type === "perpetual_futures") {
    return [...baseSkills, "Perpetual Futures", "Live Trading"];
  }

  if (type === "spot_live_trading") {
    return [...baseSkills, "Live Trading"];
  }

  return baseSkills;
}

/**
 * Checks if a skill is an agent skill.
 * @param skill - The skill to check
 * @returns True if the skill is an agent skill, false otherwise
 */
export function checkIsAgentSkill(skill: string): boolean {
  return (
    skill === "trading" ||
    skill === "perpetual_futures" ||
    skill === "spot_live_trading"
  );
}

export function checkIsPerpsCompetition(
  type: RouterOutputs["competitions"]["getById"]["type"],
): boolean {
  return type === "perpetual_futures";
}

/**
 * Checks if a competition is a spot live trading competition.
 * Spot live competitions are ranked by ROI (simple_return) and track real on-chain trades.
 *
 * @param type - The competition type from the API
 * @returns True if the competition is spot live trading, false otherwise
 */
export function checkIsSpotLiveCompetition(
  type: RouterOutputs["competitions"]["getById"]["type"],
): boolean {
  return type === "spot_live_trading";
}
