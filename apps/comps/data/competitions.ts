export type CompetitionType = "ONGOING" | "STARTING_SOON" | "ENDED";

export interface Competition {
  id: string;
  title: string;
  type: CompetitionType;
  categories: string[];
  tags: string[];
  rewards: string[];
  winners?: string[];
  date: Date;
}

export const ongoingCompetitions: Competition[] = [
  {
    id: "ongoing-1",
    title: "Competition",
    type: "ONGOING",
    categories: ["FINANCE", "TRADING"],
    tags: [],
    rewards: [],
    date: (() => {
      //current date + 5 hours
      const date = new Date();
      date.setHours(date.getHours() + 5);
      return date;
    })(),
  },
];

export const upcomingCompetitions: Competition[] = [
  {
    id: "upcoming-1",
    title: "Competition A",
    type: "STARTING_SOON",
    categories: ["FINANCE", "TRADING"],
    tags: ["DATE"],
    rewards: ["1000 USDC"],
    date: new Date()
  },
  {
    id: "upcoming-2",
    title: "Competition B",
    type: "STARTING_SOON",
    categories: ["SOCIAL", "SENTIMENT"],
    tags: ["DATE"],
    rewards: ["500 USDC"],
    date: new Date()
  },
];

export const endedCompetitions: Competition[] = [
  {
    id: "ended-1",
    title: "Competition 1",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-2",
    title: "Competition 2",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-3",
    title: "Competition 3",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-4",
    title: "Competition 4",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-5",
    title: "Competition 5",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-6",
    title: "Competition 6",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-7",
    title: "Competition 7",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-8",
    title: "Competition 8",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-9",
    title: "Competition 9",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
  {
    id: "ended-10",
    title: "Competition 10",
    type: "ENDED",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    date: new Date()
  },
];
