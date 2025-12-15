import type { LeaderboardAgent } from "./main.js";

// ============================================================================
// BENCHMARK DATA TYPES
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
  /** Category type - "benchmark" for static skills, "trading" for trading agents, "perpetual_futures" for perpetual futures agents */
  category: "benchmark" | "trading" | "perpetual_futures";
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
// UNIFIED LEADERBOARD TYPES
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
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
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
