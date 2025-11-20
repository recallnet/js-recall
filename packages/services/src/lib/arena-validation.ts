import { CompetitionType } from "../types/index.js";

/**
 * Maps arena skills to compatible competition types
 * Extend this registry when adding new arena and competition types
 */
export const SKILL_TYPE_COMPATIBILITY: Record<string, CompetitionType[]> = {
  // Trading arenas
  spot_paper_trading: ["trading"],
  perpetual_futures: ["perpetual_futures"],
  spot_live_trading: ["spot_live_trading"],

  // Future expansion examples:
  // Prediction markets
  // binary_prediction: ["prediction"],
  // multi_outcome_prediction: ["prediction"],

  // Coding challenges
  // javascript_coding: ["coding"],
  // python_coding: ["coding"],
};

/**
 * Validates that a competition type is compatible with an arena's skill
 * @param arenaSkill The arena's skill type
 * @param competitionType The competition type to validate
 * @returns True if compatible, false otherwise
 */
export function isCompatibleType(
  arenaSkill: string,
  competitionType: CompetitionType,
): boolean {
  const compatibleTypes = SKILL_TYPE_COMPATIBILITY[arenaSkill];

  if (!compatibleTypes) {
    // Unknown skill - allow for backward compatibility but should be rare
    // In production, consider logging a warning for monitoring
    return true;
  }

  return compatibleTypes.includes(competitionType);
}

/**
 * Gets the expected competition type for an arena skill
 * Returns the first compatible type from the registry
 * @param arenaSkill The arena's skill type
 * @returns Expected competition type or undefined if skill is unknown
 */
export function getExpectedTypeForSkill(
  arenaSkill: string,
): CompetitionType | undefined {
  const types = SKILL_TYPE_COMPATIBILITY[arenaSkill];
  return types?.[0];
}

/**
 * Maps competition type to arena skill
 * Inverse of getExpectedTypeForSkill
 * @param competitionType The competition type
 * @returns Arena skill or "trading" as default
 */
export function getSkillForCompetitionType(
  competitionType: CompetitionType,
): string {
  // Find the skill that maps to this type
  for (const [skill, types] of Object.entries(SKILL_TYPE_COMPATIBILITY)) {
    if (types.includes(competitionType)) {
      return skill;
    }
  }

  // Fallback for unknown types
  if (competitionType === "perpetual_futures") {
    return "perpetual_futures";
  }
  if (competitionType === "spot_live_trading") {
    return "spot_live_trading";
  }
  return "spot_paper_trading";
}
