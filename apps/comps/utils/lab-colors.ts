// Dynamic lab color generation system
// Provides consistent colors for AI labs/providers

const KNOWN_LAB_COLORS: Record<string, string> = {
  // Major labs with brand-specific colors (avoiding Scale AI's exact colors)
  openai: "#2563EB", // Deep blue
  anthropic: "#7C3AED", // Warm purple
  "meta-llama": "#10B981", // Bright green
  meta: "#10B981", // Alias for meta-llama
  google: "#EF4444", // Coral red
  mistralai: "#F59E0B", // Amber orange
  mistral: "#F59E0B", // Alias for mistralai
  microsoft: "#06B6D4", // Cyan blue
  deepseek: "#6B7280", // Cool gray
  qwen: "#EC4899", // Magenta
  alibaba: "#EC4899", // Alias for qwen
  amazon: "#059669", // Forest green
  cohere: "#8B5CF6", // Purple
  ai21: "#F97316", // Orange
  together: "#14B8A6", // Teal
  fireworks: "#DC2626", // Red
  anyscale: "#7C2D12", // Brown
  replicate: "#1D4ED8", // Blue
};

// Professional color palette for unknown providers
const FALLBACK_COLORS = [
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#6366F1", // Indigo
  "#A855F7", // Violet
  "#22C55E", // Green
  "#EAB308", // Yellow
  "#DC2626", // Red-600
  "#0891B2", // Sky
];

/**
 * Generate a consistent color for a provider using a hash function
 */
function generateColorFromProvider(provider: string): string {
  // Simple hash function for consistent color generation
  let hash = 0;
  for (let i = 0; i < provider.length; i++) {
    const char = provider.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use hash to select from fallback colors
  const index = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index]!;
}

/**
 * Get color for a lab/provider with fallback generation
 */
export function getLabColor(provider: string): string {
  if (!provider) return FALLBACK_COLORS[0]!;

  const normalizedProvider = provider.toLowerCase().trim();

  // Check known colors first
  if (KNOWN_LAB_COLORS[normalizedProvider]) {
    return KNOWN_LAB_COLORS[normalizedProvider]!;
  }

  // Check for partial matches (e.g., "meta-llama" contains "meta")
  const partialMatch = Object.keys(KNOWN_LAB_COLORS).find(
    (key) =>
      normalizedProvider.includes(key) || key.includes(normalizedProvider),
  );

  if (partialMatch) {
    return KNOWN_LAB_COLORS[partialMatch]!;
  }

  // Generate consistent color for unknown provider
  return generateColorFromProvider(normalizedProvider);
}

/**
 * Get all known lab colors for display/legend purposes
 */
export function getKnownLabColors(): Record<string, string> {
  return { ...KNOWN_LAB_COLORS };
}

/**
 * Add or update a lab color (for dynamic updates)
 */
export function setLabColor(provider: string, color: string): void {
  KNOWN_LAB_COLORS[provider.toLowerCase()] = color;
}
