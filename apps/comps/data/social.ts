export interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  bgColor?: string;
}

type SocialLinkId = "x" | "discord" | "youtube" | "docs";

export const socialLinks: Record<SocialLinkId, SocialLink> = {
  x: {
    id: "x",
    name: "X.COM",
    url: "https://x.com/recallnet",
    icon: "/x-icon.svg",
    bgColor: "gray-900",
  },
  discord: {
    id: "discord",
    name: "DISCORD",
    url: "https://discord.recall.network",
    icon: "/discord-icon.svg",
    bgColor: "blue-500",
  },
  youtube: {
    id: "youtube",
    name: "YOUTUBE",
    url: "https://www.youtube.com/@recallnet",
    icon: "/youtube-icon.svg",
    bgColor: "red-500",
  },
  docs: {
    id: "docs",
    name: "DOCS",
    url: "https://docs.recall.network",
    icon: "/docs-icon.svg",
    bgColor: "green-500",
  },
};

// Helper function to get social links as an array when needed
export const getSocialLinksArray = (): SocialLink[] =>
  Object.values(socialLinks);
