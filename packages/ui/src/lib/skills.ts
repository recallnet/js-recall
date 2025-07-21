/**
 * Skill mapping utilities for frontend display
 * Maps database/API skill keys to user-friendly display names
 */

export type SkillKey = 
  | "trading" 
  | "social_chat" 
  | "traditional_investing"
  | "art_video" 
  | "sports_betting"
  | "programming"
  | "prediction_markets"
  | "research"
  | "other";

export type SkillDisplay = 
  | "Crypto Trading"
  | "Social and Chat"
  | "Traditional Investing" 
  | "Art & Video Creation"
  | "Sports Betting"
  | "Programming / Coding"
  | "Prediction Markets"
  | "Deep Research"
  | "Other";

/**
 * Maps database/API skill keys to display names
 */
export const SKILL_DISPLAY_MAP: Record<SkillKey, SkillDisplay> = {
  trading: "Crypto Trading",
  social_chat: "Social and Chat",
  traditional_investing: "Traditional Investing",
  art_video: "Art & Video Creation", 
  sports_betting: "Sports Betting",
  programming: "Programming / Coding",
  prediction_markets: "Prediction Markets",
  research: "Deep Research",
  other: "Other",
};

/**
 * Maps display names back to database/API keys
 */
export const DISPLAY_SKILL_MAP: Record<SkillDisplay, SkillKey> = {
  "Crypto Trading": "trading",
  "Social and Chat": "social_chat", 
  "Traditional Investing": "traditional_investing",
  "Art & Video Creation": "art_video",
  "Sports Betting": "sports_betting",
  "Programming / Coding": "programming",
  "Prediction Markets": "prediction_markets",
  "Deep Research": "research",
  "Other": "other",
};

/**
 * Array of all available skill display names in order
 */
export const SKILL_OPTIONS: SkillDisplay[] = [
  "Crypto Trading",
  "Social and Chat", 
  "Traditional Investing",
  "Art & Video Creation",
  "Sports Betting",
  "Programming / Coding",
  "Prediction Markets", 
  "Deep Research",
  "Other",
];

/**
 * Convert skill keys from API/database to display names
 */
export function skillsToDisplay(skills: string[]): SkillDisplay[] {
  return skills
    .map(skill => SKILL_DISPLAY_MAP[skill as SkillKey])
    .filter((skill): skill is SkillDisplay => skill !== undefined);
}

/**
 * Convert display names back to skill keys for API/database
 */
export function skillsToKeys(skills: SkillDisplay[]): SkillKey[] {
  return skills
    .map(skill => DISPLAY_SKILL_MAP[skill])
    .filter((skill): skill is SkillKey => skill !== undefined);
}

/**
 * Get display name for a single skill key
 */
export function getSkillDisplay(skill: string): SkillDisplay | string {
  return SKILL_DISPLAY_MAP[skill as SkillKey] || skill;
}

/**
 * Get skill key for a single display name
 */
export function getSkillKey(displayName: string): SkillKey | string {
  return DISPLAY_SKILL_MAP[displayName as SkillDisplay] || displayName;
}