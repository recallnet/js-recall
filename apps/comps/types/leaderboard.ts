/**
 * Unified Leaderboard Type Definitions
 * Complete type system for benchmark models, trading agents, and UI components
 * Combines static JSON schema + live API data + UI-specific types
 */
import type { LeaderboardAgent } from "./agent";

// ============================================================================
// CORE DATA TYPES (from benchmark-leaderboard-schema.ts)
// ============================================================================

/**
 * Top-level metadata about the benchmark dataset
 */
export interface BenchmarkMetadata {
  /** ISO 8601 timestamp of when the data was last updated */
  lastUpdated: string;
  /** Link to the benchmark repository or documentation */
  benchmarkLink?: string;
}

/**
 * Research paper or reference link
 */
export interface ResearchLink {
  /** Title of the research paper or resource */
  title: string;
  /** URL to the research paper or resource */
  url: string;
}

/**
 * Definition of a benchmark skill/task
 */
export interface SkillDefinition {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name of the skill */
  name: string;
  /** Brief description of what the skill measures */
  description: string;
  /** Detailed description of the skill evaluation (supports markdown) */
  longDescription?: string;
  /** Category type - "benchmark" for static skills, "trading" for live agents */
  category: "benchmark" | "trading";
  /** Array of research papers related to this skill (optional) */
  researchLinks?: ResearchLink[];
  /** Display order for UI sorting */
  displayOrder: number;
  /** Whether this skill is currently enabled for evaluation */
  isEnabled: boolean;
  /** Description of the evaluation methodology (optional) */
  methodology?: string;
}

/**
 * Contamination level indicating potential data leakage
 */
export type ContaminationLevel = "none" | "low" | "medium" | "high";

/**
 * Individual benchmark score for a specific skill
 */
export interface BenchmarkScore {
  /** Raw numerical score */
  rawScore: number;
  /** Confidence interval as [lower_bound, upper_bound] (optional) */
  confidenceInterval?: [number, number];
  /** Rank position for this skill (1 = best) */
  rank: number;
  /** ISO 8601 timestamp of when this evaluation was performed */
  evaluatedAt: string;
  /** Level of potential contamination in the evaluation (optional) */
  contamination?: ContaminationLevel;
  /** Number of samples used in the evaluation (optional) */
  sampleSize?: number;
  /** General notice or warning about this evaluation (optional) */
  notice?: string;
}

/**
 * Supported input/output modalities (aligned with OpenRouter)
 */
export type Modality = "text" | "image" | "audio";

/**
 * Model architecture information (aligned with OpenRouter API)
 */
export interface ModelArchitecture {
  /** Supported input modalities */
  input_modalities: Modality[];
  /** Supported output modalities */
  output_modalities: Modality[];
  /** Tokenizer type */
  tokenizer?: string;
  /** Instruction type/format */
  instruct_type?: string | null;
}

/**
 * Top provider information (aligned with OpenRouter API)
 */
export interface TopProvider {
  /** Whether the provider moderates content */
  is_moderated?: boolean;
  /** Maximum context length in tokens */
  context_length: number;
  /** Maximum completion tokens */
  max_completion_tokens?: number | null;
}

/**
 * Pricing information (aligned with OpenRouter API)
 */
export interface ModelPricing {
  /** Cost per token for prompts */
  prompt: string;
  /** Cost per token for completions */
  completion: string;
  /** Cost per image (if applicable) */
  image?: string;
  /** Cost per request (if applicable) */
  request?: string;
}

/**
 * A benchmark model with scores and OpenRouter-aligned metadata (flattened structure)
 */
export interface BenchmarkModel {
  // Benchmark-specific fields
  /** Scores for each skill this model was evaluated on */
  scores: Record<string, BenchmarkScore>;
  /** Provider/lab that created the model (for UI grouping and colors) */
  provider: string;
  /** Model family/series name (for UI grouping) */
  modelFamily: string;

  // OpenRouter API aligned fields
  /** OpenRouter model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Unix timestamp of model creation */
  created?: number;
  /** Description of the model's capabilities */
  description?: string;
  /** Model architecture information */
  architecture?: ModelArchitecture;
  /** Top provider information */
  top_provider?: TopProvider;
  /** Pricing information */
  pricing?: ModelPricing;
  /** Canonical slug identifier */
  canonical_slug?: string;
  /** Maximum context length (also in top_provider, kept for compatibility) */
  context_length?: number;
  /** Hugging Face model identifier */
  hugging_face_id?: string;
  /** Supported parameters for this model */
  supported_parameters?: string[];
}

/**
 * Statistical summary for a specific skill
 */
export interface SkillStats {
  /** Total number of models evaluated for this skill */
  totalModels: number;
  /** Average score across all models */
  avgScore: number;
  /** Highest score achieved */
  topScore: number;
  /** Median score across all models */
  medianScore: number;
  /** Total number of evaluations performed (totalModels * sampleSize) */
  evaluationCount: number;
}

/**
 * Complete benchmark leaderboard data structure
 */
export interface BenchmarkLeaderboardData {
  /** Metadata about the benchmark dataset */
  metadata: BenchmarkMetadata;
  /** Map of skill ID to skill definition */
  skills: Record<string, SkillDefinition>;
  /** Array of all evaluated models */
  models: BenchmarkModel[];
  /** Array of all trading agents (for 7d-pnl skill) */
  agents?: LeaderboardAgent[];
  /** Statistical summaries for each skill */
  skillStats: Record<string, SkillStats>;
}

// ============================================================================
// UI-SPECIFIC TYPES (from unified-leaderboard.ts)
// ============================================================================

/**
 * Unified data structure combining static + live data
 */
export interface UnifiedSkillData {
  skill: SkillDefinition;
  participants: {
    models: BenchmarkModel[];
    agents: LeaderboardAgent[];
  };
  stats: {
    totalParticipants: number;
    modelCount: number;
    agentCount: number;
    avgScore?: number;
    topScore?: number;
  };
}

/**
 * Complete unified leaderboard data (benchmark + trading)
 */
export interface UnifiedLeaderboardData {
  skills: {
    [skillId: string]: SkillDefinition;
  };
  skillData: {
    [skillId: string]: UnifiedSkillData;
  };
  globalStats: {
    totalSkills: number;
    totalModels: number;
    totalAgents: number;
  };
}

/**
 * UI component props interfaces
 */
export interface SkillOverviewCardProps {
  skill: SkillDefinition;
  stats: UnifiedSkillData["stats"];
  topParticipants: Array<BenchmarkModel | LeaderboardAgent>;
}

/**
 * Unified ranking entry for display
 */
export interface UnifiedRankingEntry {
  id: string;
  name: string;
  type: "model" | "agent";
  rank: number;
  score: number;
  provider?: string; // For models
  imageUrl?: string; // For agents
  metadata?: Partial<BenchmarkModel>; // For models (updated to use BenchmarkModel)
  additionalMetrics?: {
    trades?: number;
    volume?: number;
    competitions?: number;
  }; // For agents
}

/**
 * Model metadata display component props
 */
export interface ModelMetadataDisplayProps {
  model: BenchmarkModel;
  compact?: boolean;
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

/**
 * Filter and sorting interfaces
 */
export interface LeaderboardFilters {
  participantType: "all" | "models" | "agents";
  provider?: string;
  skillId?: string;
}

export interface LeaderboardSort {
  field: "rank" | "score" | "name" | "provider";
  direction: "asc" | "desc";
}

// ============================================================================
// VALIDATION FUNCTIONS (from benchmark-leaderboard-schema.ts)
// ============================================================================

/**
 * Type guard to check if an object is a valid BenchmarkScore
 */
export function isBenchmarkScore(obj: unknown): obj is BenchmarkScore {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  return (
    typeof record.rawScore === "number" &&
    typeof record.rank === "number" &&
    typeof record.evaluatedAt === "string" &&
    (record.confidenceInterval === undefined ||
      (Array.isArray(record.confidenceInterval) &&
        record.confidenceInterval.length === 2 &&
        typeof record.confidenceInterval[0] === "number" &&
        typeof record.confidenceInterval[1] === "number")) &&
    (record.contamination === undefined ||
      ["none", "low", "medium", "high"].includes(
        record.contamination as string,
      )) &&
    (record.sampleSize === undefined ||
      typeof record.sampleSize === "number") &&
    (record.notice === undefined || typeof record.notice === "string")
  );
}

/**
 * Type guard to check if an object is a valid BenchmarkModel
 */
export function isBenchmarkModel(obj: unknown): obj is BenchmarkModel {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.provider === "string" &&
    typeof record.modelFamily === "string" &&
    typeof record.scores === "object"
  );
}

/**
 * Type guard to check if an object is valid BenchmarkLeaderboardData
 */
export function isBenchmarkLeaderboardData(
  obj: unknown,
): obj is BenchmarkLeaderboardData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  return (
    typeof record.metadata === "object" &&
    typeof record.skills === "object" &&
    Array.isArray(record.models) &&
    typeof record.skillStats === "object"
  );
}

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

/**
 * Constants for validation
 */
export const VALID_CONTAMINATION_LEVELS: ContaminationLevel[] = [
  "none",
  "low",
  "medium",
  "high",
];
export const VALID_MODALITIES: Modality[] = ["text", "image", "audio"];

/**
 * Helper types for creating new objects
 */
export type CreateBenchmarkScore = Omit<BenchmarkScore, "rank"> & {
  rank?: number; // Make rank optional for creation, can be calculated
};

export type CreateBenchmarkModel = Omit<BenchmarkModel, "scores"> & {
  scores?: Record<string, CreateBenchmarkScore>; // Make scores optional for creation
};

/**
 * Utility types
 */
export type SkillId<T extends BenchmarkLeaderboardData> = keyof T["skills"];
export type ProviderName = BenchmarkModel["provider"];

/**
 * Validation class with comprehensive data checking
 */
export class BenchmarkDataValidator {
  /**
   * Validate a complete benchmark dataset
   */
  static validateData(data: unknown): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!isBenchmarkLeaderboardData(data)) {
      errors.push("Invalid root data structure");
      return { isValid: false, errors };
    }

    // Validate metadata
    if (!data.metadata.lastUpdated) {
      errors.push("Missing required metadata field: lastUpdated");
    }

    // Validate skills
    for (const [skillId, skill] of Object.entries(data.skills)) {
      if (skill.id !== skillId) {
        errors.push(`Skill ID mismatch: ${skillId} vs ${skill.id}`);
      }
      if (!skill.name || !skill.description) {
        errors.push(`Missing required fields for skill: ${skillId}`);
      }
    }

    // Validate models
    for (const model of data.models) {
      if (!isBenchmarkModel(model)) {
        errors.push(
          `Invalid model structure: ${typeof model === "object" && model !== null && "id" in model ? (model as { id: unknown }).id : "unknown"}`,
        );
        continue;
      }

      // Validate scores
      for (const [skillId, score] of Object.entries(model.scores)) {
        if (!isBenchmarkScore(score)) {
          errors.push(`Invalid score for model ${model.id}, skill ${skillId}`);
        }
        if (!(skillId in data.skills)) {
          errors.push(
            `Model ${model.id} has score for unknown skill: ${skillId}`,
          );
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate that skill stats match the actual model data
   */
  static validateSkillStats(data: BenchmarkLeaderboardData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const [skillId, stats] of Object.entries(data.skillStats)) {
      const modelsWithSkill = data.models.filter((m) => skillId in m.scores);

      if (stats.totalModels !== modelsWithSkill.length) {
        errors.push(
          `Skill ${skillId}: totalModels mismatch (${stats.totalModels} vs ${modelsWithSkill.length})`,
        );
      }

      if (modelsWithSkill.length > 0) {
        const scores = modelsWithSkill.map((m) => m.scores[skillId]!.rawScore);
        const actualAvg =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const actualTop = Math.max(...scores);

        if (Math.abs(stats.avgScore - actualAvg) > 0.1) {
          errors.push(
            `Skill ${skillId}: avgScore mismatch (${stats.avgScore} vs ${actualAvg.toFixed(2)})`,
          );
        }

        if (Math.abs(stats.topScore - actualTop) > 0.1) {
          errors.push(
            `Skill ${skillId}: topScore mismatch (${stats.topScore} vs ${actualTop})`,
          );
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
