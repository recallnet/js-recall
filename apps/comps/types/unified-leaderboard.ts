// Unified Leaderboard Type Definitions
// Combines benchmark models (static JSON) + trading agents (live API)

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: "benchmark" | "trading";
  researchLinks?: Array<{
    title: string;
    url: string;
  }>;
  displayOrder: number;
  isEnabled: boolean;
  methodology?: string;
  examplePrompts?: string[];
}

export interface BenchmarkScore {
  rawScore: number;
  confidenceInterval?: [number, number];
  rank: number;
  evaluatedAt: string;
  contamination?: "none" | "low" | "medium" | "high";
  sampleSize?: number;
  notice?: string;
}

export interface OpenRouterMetadata {
  // Core identifiers
  openrouterId: string;
  author: string;
  group?: string;

  // Technical specifications
  contextLength: number;
  parameterCount?: string;
  architecture?: string;

  // Instruction and formatting
  instructionType?: string;
  defaultStops?: string[];

  // Capabilities
  inputModalities: string[];
  outputModalities: string[];

  // Infrastructure
  provider?: string;
  quantization?: string;
  variant?: string;

  // Business information
  created: string;
  description: string;
  pricing: {
    input: number;
    output: number;
  };

  // Display metadata
  labLogoPath: string;
}

export interface BenchmarkModel {
  id: string;
  name: string;
  provider: string;
  modelFamily: string;
  scores: {
    [skillId: string]: BenchmarkScore;
  };
  metadata: OpenRouterMetadata;
}

export interface SkillStats {
  totalModels: number;
  avgScore: number;
  topScore: number;
  medianScore: number;
  evaluationCount: number;
}

export interface BenchmarkLeaderboardPayload {
  metadata: {
    lastUpdated: string;
    version: string;
    dataSource: "static";
    generatedBy: string;
    benchmarkVersion: string;
  };
  skills: {
    [skillId: string]: SkillDefinition;
  };
  models: BenchmarkModel[];
  skillStats: {
    [skillId: string]: SkillStats;
  };
}

// Unified data structure combining static + live data
export interface UnifiedSkillData {
  skill: SkillDefinition;
  participants: {
    models: BenchmarkModel[];
    agents: import("./agent").LeaderboardAgent[];
  };
  stats: {
    totalParticipants: number;
    modelCount: number;
    agentCount: number;
    avgScore?: number;
    topScore?: number;
  };
}

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

// UI component props interfaces
export interface SkillOverviewCardProps {
  skill: SkillDefinition;
  stats: UnifiedSkillData["stats"];
  topParticipants: Array<BenchmarkModel | import("./agent").LeaderboardAgent>;
}

export interface UnifiedRankingEntry {
  id: string;
  name: string;
  type: "model" | "agent";
  rank: number;
  score: number;
  provider?: string; // For models
  imageUrl?: string; // For agents
  metadata?: Partial<OpenRouterMetadata>; // For models
  additionalMetrics?: {
    trades?: number;
    volume?: number;
    competitions?: number;
  }; // For agents
}

export interface ModelMetadataDisplayProps {
  model: BenchmarkModel;
  compact?: boolean;
}

export interface LabLogoProps {
  provider: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showFallback?: boolean;
}

// Filter and sorting interfaces
export interface LeaderboardFilters {
  participantType: "all" | "models" | "agents";
  provider?: string;
  skillId?: string;
}

export interface LeaderboardSort {
  field: "rank" | "score" | "name" | "provider";
  direction: "asc" | "desc";
}
