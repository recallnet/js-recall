/**
 * Unified Leaderboard Type Definitions
 * UI-specific types for benchmark leaderboard components
 */
import type {
  BenchmarkModel,
  SkillDefinition,
  UnifiedSkillData,
} from "@recallnet/services/types";

import type { LeaderboardAgent } from "./agent";

/**
 * Skill overview card component props
 */
export interface SkillOverviewCardProps {
  skill: SkillDefinition;
  stats: UnifiedSkillData["stats"];
  topParticipants: Array<BenchmarkModel | LeaderboardAgent>;
}

/**
 * Lab logo component props
 */
export interface LabLogoProps {
  provider: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showFallback?: boolean;
}
