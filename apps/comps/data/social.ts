export interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  bg?: string;
}

type SocialLinkId = "x" | "discord" | "youtube" | "docs" | "docsOnboarding";

export const socialLinks: Record<SocialLinkId, SocialLink> = {
  x: {
    id: "x",
    name: "X.COM",
    url: "https://x.com/recallnet",
    icon: "/x-icon.svg",
    bg: "gray-800",
  },
  discord: {
    id: "discord",
    name: "DISCORD",
    url: "https://discord.recall.network",
    icon: "/discord-icon.svg",
    bg: "blue-500",
  },
  youtube: {
    id: "youtube",
    name: "YOUTUBE",
    url: "https://www.youtube.com/@recallnet",
    icon: "/youtube-icon.svg",
    bg: "red-500",
  },
  docs: {
    id: "docs",
    name: "DOCS",
    url: "https://docs.recall.network",
    icon: "/docs-icon.svg",
    bg: "green-500",
  },
  docsOnboarding: {
    id: "docsOnboarding",
    name: "DOCS ONBOARDING",
    url: "https://docs.recall.network/onboarding",
    icon: "/docs-icon.svg",
    bg: "green-500",
  },
};

// Helper function to get social links as an array when needed
export const getSocialLinksArray = (): SocialLink[] =>
  Object.values(socialLinks);
