export interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export const socialLinks: SocialLink[] = [
  {
    id: "x",
    name: "X.COM",
    url: "https://x.com/recallnet",
    icon: "/x-icon.svg",
  },
  {
    id: "discord",
    name: "DISCORD",
    url: "https://discord.recall.network",
    icon: "/discord-icon.svg",
  },
  {
    id: "youtube",
    name: "YOUTUBE",
    url: "https://www.youtube.com/@recallnet",
    icon: "/youtube-icon.svg",
  },
  {
    id: "docs",
    name: "DOCS",
    url: "https://docs.recall.network",
    icon: "/docs-icon.svg",
  },
];
