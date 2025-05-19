export interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  bg?: string;
}

export const socialLinks: SocialLink[] = [
  {
    id: "x",
    name: "X.COM",
    url: "https://x.com/recallnet",
    icon: "/x-icon.svg",
    bg: 'card'
  },
  {
    id: "discord",
    name: "DISCORD",
    url: "https://discord.recall.network",
    icon: "/discord-icon.svg",
    bg: 'blue-500'
  },
  {
    id: "youtube",
    name: "YOUTUBE",
    url: "https://www.youtube.com/@recallnet",
    icon: "/youtube-icon.svg",
    bg: 'red-500'
  },
  {
    id: "docs",
    name: "DOCS",
    url: "https://docs.recall.network",
    icon: "/docs-icon.svg",
    bg: 'green-500'
  },
];
