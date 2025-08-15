// Dynamic lab color generation system
// Provides consistent, professional muted colors for AI labs/providers
// Color palette inspired by modern corporate design with sophisticated tones

const KNOWN_LAB_COLORS: Record<string, string> = {
  // Major labs with professional, muted colors inspired by corporate design
  openai: "#4A90B8", // Muted steel blue
  anthropic: "#8B7CB6", // Soft lavender
  "meta-llama": "#7BA05B", // Sage green
  meta: "#7BA05B", // Alias for meta-llama
  google: "#D4857F", // Distinct coral (shifted from #C4787A to avoid fireworks conflict)
  mistralai: "#B8956A", // Warm taupe
  mistral: "#B8956A", // Alias for mistralai
  microsoft: "#7A9FB8", // Distinct sky blue (shifted from #6B9DB8)
  deepseek: "#8A8E94", // Professional gray
  qwen: "#A885A3", // Muted plum
  alibaba: "#A885A3", // Alias for qwen
  amazon: "#7A9B7F", // Forest sage
  cohere: "#9D8F7A", // Distinct warm stone (shifted from #A39078 to avoid anyscale conflict)
  ai21: "#C49B6A", // Distinct bronze (shifted from #B8956A to avoid mistral conflict)
  together: "#7BB3A8", // Seafoam
  fireworks: "#BA8285", // Distinct muted coral (shifted from #B87A7A to avoid google conflict)
  anyscale: "#9B8B7A", // Warm gray
  replicate: "#5A8AB3", // Distinct navy (shifted from #6B8DB8 to avoid openai conflict)
};

// Professional muted color palette for unknown providers (66 unique colors, no conflicts with known labs)
const FALLBACK_COLORS = [
  // Blues (avoiding known blue conflicts)
  "#8CA4C4", // Soft blue
  "#A5B8D0", // Light blue gray
  "#6F8FA8", // Muted slate blue
  "#9FB5CC", // Powder blue
  "#7E9BBC", // Steel blue
  "#B2C4D8", // Misty blue
  "#85A5C0", // Cloudy blue
  "#98B2C8", // Soft periwinkle

  // Greens (avoiding known green conflicts)
  "#8FAE8F", // Soft mint
  "#A5C2A5", // Light sage
  "#95B895", // Pale green
  "#B8D4B8", // Mint cream
  "#88AA88", // Moss sage
  "#A8C8A8", // Eucalyptus
  "#92B592", // Forest mist
  "#B5D0B5", // Spa green

  // Purples (avoiding known purple conflicts)
  "#A598B8", // Soft lilac
  "#B8A5D0", // Light orchid
  "#9F8FB8", // Muted violet
  "#C2A5C8", // Pale purple
  "#AB98C4", // Heather
  "#B5A5CC", // Lavender mist
  "#A09BB5", // Purple gray
  "#C8B5D8", // Soft mauve

  // Browns/Taupes (avoiding known brown conflicts)
  "#B5A592", // Light taupe
  "#C8B5A5", // Warm beige
  "#A59B88", // Mushroom
  "#D0C2B5", // Linen
  "#B8AA95", // Sand
  "#C4B8A8", // Stone
  "#A8A095", // Clay
  "#D4C8B8", // Cream

  // Corals/Pinks (avoiding known coral conflicts)
  "#C8A5A5", // Soft coral
  "#D0B5B5", // Blush
  "#B89898", // Dusty pink
  "#D8C2C2", // Rose cream
  "#C2A098", // Peach
  "#D4B8B5", // Light coral
  "#B5A098", // Mauve pink
  "#D8C8C2", // Pink beige

  // Grays (avoiding known gray conflicts)
  "#A5A8AB", // Light gray
  "#B8BBC0", // Silver gray
  "#9FA5A8", // Steel gray
  "#C2C8CC", // Cloud gray
  "#A8AEB5", // Slate gray
  "#B5BBC2", // Pewter
  "#98A0A5", // Storm gray
  "#C8CED4", // Mist gray

  // Teals/Cyans (avoiding known teal conflicts)
  "#8FB8B5", // Soft teal
  "#A5C8C2", // Aqua mist
  "#92B5B2", // Sage teal
  "#B8D4D0", // Mint teal
  "#85B2A8", // Ocean sage
  "#A8C8C4", // Sea foam
  "#95B8B5", // Turquoise gray
  "#B5D0CC", // Spa teal

  // Yellows/Golds (avoiding conflicts)
  "#B8B595", // Soft gold
  "#C8C2A5", // Champagne
  "#B2A888", // Khaki
  "#D0C8B5", // Cream gold
  "#B5B088", // Olive gold
  "#C4C0A8", // Pale gold
  "#A8A585", // Sage gold
  "#D4D0B8", // Light champagne

  // Additional unique tones
  "#C0A8B5", // Rose taupe
  "#B5C0A8", // Sage beige
  "#A8B5C0", // Blue beige
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
  return FALLBACK_COLORS[index] || "#8CA4C4";
}

/**
 * Get color for a lab/provider with fallback generation
 */
export function getLabColor(provider: string): string {
  if (!provider) return FALLBACK_COLORS[0] || "#8CA4C4";

  const normalizedProvider = provider.toLowerCase().trim();

  // Check known colors first
  const knownColor = KNOWN_LAB_COLORS[normalizedProvider];
  if (knownColor) {
    return knownColor;
  }

  // Check for partial matches (e.g., "meta-llama" contains "meta")
  const partialMatch = Object.keys(KNOWN_LAB_COLORS).find(
    (key) =>
      normalizedProvider.includes(key) || key.includes(normalizedProvider),
  );

  if (partialMatch) {
    return KNOWN_LAB_COLORS[partialMatch] || FALLBACK_COLORS[0] || "#8CA4C4";
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

// Agent-specific colors (professional muted palette matching lab aesthetic)
const AGENT_COLORS = [
  "#7BA05B", // Sage green
  "#8B7CB6", // Soft lavender
  "#D4857F", // Coral
  "#B8956A", // Warm taupe
  "#7A9FB8", // Sky blue
  "#8A8E94", // Professional gray
  "#A885A3", // Muted plum
  "#7A9B7F", // Forest sage
  "#9D8F7A", // Warm stone
  "#C49B6A", // Bronze
  "#7BB3A8", // Seafoam
  "#BA8285", // Muted coral
  "#9B8B7A", // Warm gray
  "#5A8AB3", // Navy
  "#8CA4C4", // Soft blue
  "#A5B8D0", // Light blue gray
  "#8FAE8F", // Soft mint
  "#A5C2A5", // Light sage
  "#A598B8", // Soft lilac
  "#B8A5D0", // Light orchid
  "#B5A592", // Light taupe
  "#C8B5A5", // Warm beige
  "#C8A5A5", // Soft coral
  "#D0B5B5", // Blush
  "#A5A8AB", // Light gray
  "#B8BBC0", // Silver gray
  "#8FB8B5", // Soft teal
  "#A5C8C2", // Aqua mist
  "#B8B595", // Soft gold
  "#C8C2A5", // Champagne
  "#C0A8B5", // Rose taupe
  "#B5C0A8", // Sage beige
];

/**
 * Generate a consistent color for an agent based on their name/ID
 */
function generateColorFromAgent(agentName: string): string {
  const name = agentName.toLowerCase().trim();

  // Use FNV-1a hash algorithm for better distribution
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
  }

  // Add additional entropy from string characteristics
  hash ^= name.length << 16;
  hash ^= (name.charCodeAt(0) || 0) << 8;
  hash ^= name.charCodeAt(name.length - 1) || 0;

  // Ensure positive value and select from agent colors
  const index = Math.abs(hash) % AGENT_COLORS.length;
  return AGENT_COLORS[index] || "#7BA05B";
}

/**
 * Get color for an agent with consistent generation
 */
export function getAgentColor(agentName: string): string {
  if (!agentName) return AGENT_COLORS[0] || "#7BA05B";
  return generateColorFromAgent(agentName);
}

/**
 * Add or update a lab color (for dynamic updates)
 */
export function setLabColor(provider: string, color: string): void {
  KNOWN_LAB_COLORS[provider.toLowerCase()] = color;
}
