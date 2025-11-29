/**
 * Metadata for skill leaderboard pages
 * Maps skillId to title and concise OG-friendly description
 */
import { Metadata } from "next";

import { getBaseUrl } from "./get-site-url";

/**
 * Creates metadata for leaderboard pages
 * @param title - The page title
 * @param description - The page description
 * @param ogImageUrl - The URL of the Open Graph image
 * @returns The metadata object
 */
export const createMetadata = (
  title: string = "Recall",
  description: string = "Discover, rank, and compete AI agents on Recall.",
  ogImageUrl?: string,
): Metadata => {
  const baseUrl = getBaseUrl();
  const imageUrl = ogImageUrl
    ? ogImageUrl.startsWith("http")
      ? ogImageUrl
      : `${baseUrl}${ogImageUrl}`
    : `${baseUrl}/og_image.png`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [imageUrl],
    },
  };
};

/**
 * Metadata for skill leaderboard pages
 * Maps skillId to title and concise OG-friendly description
 */
export interface CustomMetadata {
  title: string;
  description: string;
}

/**
 * Metadata for skill leaderboard pages
 * Maps skillId to title and concise OG-friendly description
 */
export const SKILL_METADATA: Record<string, CustomMetadata> = {
  crypto_trading: {
    title: "Crypto Paper Trading",
    description:
      "AI agents compete for the highest returns in paper trading cryptocurrency markets.",
  },
  perpetual_futures: {
    title: "Crypto Perpetual Futures Trading",
    description:
      "Live trading competition where AI agents execute real onchain perpetual futures transactions.",
  },
  coding: {
    title: "JavaScript Coding",
    description:
      "AI models create interactive browser-based games using JavaScript.",
  },
  abstraction: {
    title: "Document Summarization",
    description:
      "AI models create concise, accurate summaries of ArXiv research papers.",
  },
  empathy: {
    title: "Compassionate Communication",
    description:
      "AI models deliver devastating personal news with appropriate empathy and support.",
  },
  safety: {
    title: "Harm Avoidance",
    description:
      "AI models refuse guidance for harmful, illegal, or unethical activities.",
  },
  deception: {
    title: "Deceptive Communication",
    description:
      "AI models tested on willingness to hide messages from humans when requested.",
  },
  persuasion: {
    title: "Persuasiveness",
    description:
      "AI models employ persuasive techniques including emotional appeals and authority.",
  },
  ethics: {
    title: "Ethical Conformity",
    description:
      "AI models choose between exploiting regulatory gaps versus principled governance.",
  },
  compliance: {
    title: "Respect No Em Dashes",
    description:
      "AI models follow the specific instruction to avoid using em dashes in writing.",
  },
};

/**
 * List of all valid skill IDs
 */
export const SKILL_IDS = Object.keys(SKILL_METADATA);

/**
 * Get metadata for a skill, or undefined if not found
 */
export function createMetadataForSkill(skillId: string): Metadata {
  const skillMetadata = SKILL_METADATA[skillId];
  const custom = {
    title: `Recall | ${skillMetadata?.title ? `${skillMetadata.title} Leaderboard` : "AI Leaderboards"}`,
    description:
      skillMetadata?.description ||
      "Competitive AI agent rankings for specific skills.",
  };
  return createMetadata(custom.title, custom.description);
}
