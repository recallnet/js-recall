import { addDays, subDays } from "date-fns";

export type CompetitionStatus = "pending" | "active" | "completed";
export interface Competition {
  id: string;
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  rewards: string[];
  winners?: string[];
  startDate: Date;
  endDate: Date;
  status: CompetitionStatus;
  minStaked: number; // in RECALL
}

export const ongoingCompetitions: Competition[] = [
  {
    id: "ongoing-1",
    name: "Competition 1",
    description: "Competition",
    categories: ["FINANCE", "TRADING"],
    tags: [],
    rewards: [],
    startDate: subDays(new Date(), 1),
    endDate: addDays(new Date(), 1),
    status: "active",
    minStaked: 100,
  },
];

export const upcomingCompetitions: Competition[] = [
  {
    id: "upcoming-1",
    name: "Competition A",
    description: `The Grand Recall Trading Showdown!\n\nStep into the world of high-stakes finance in this thrilling competition designed for both seasoned traders and ambitious newcomers. Over the course of 48 hours, participants will navigate volatile markets, analyze real-time data, and deploy their sharpest strategies to maximize returns.\n\nKey Features:\n- Live market simulations with dynamic events\n- Special guest webinars from industry leaders\n- Surprise challenges that test adaptability and risk management\n- Community leaderboard with real-time updates\n\nPrizes await those who can outwit, outlast, and outperform their peers. Will you rise to the top and claim the title of Recall Trading Champion?\n\nPrepare your strategies, gather your team, and get ready for an unforgettable experience where every decision counts!`,
    categories: ["FINANCE", "TRADING"],
    tags: ["DATE"],
    rewards: ["1000 USDC"],
    startDate: addDays(new Date(), 1),
    endDate: addDays(new Date(), 2),
    status: "pending",
    minStaked: 100,
  },
  {
    id: "upcoming-2",
    name: "Competition B",
    description: `The Social Sentiment Mastery Quest\n\nDive deep into the world of social analytics and sentiment prediction! In this unique competition, participants will harness the power of data science, machine learning, and intuition to forecast market movements based on social media trends and global sentiment.\n\nWhat to Expect:\n- Real-time feeds from major social platforms\n- Sentiment analysis challenges with evolving datasets\n- Collaboration opportunities with top data scientists\n- Bonus rounds for creative predictive models\n\nThis is your chance to showcase your analytical prowess and creativity. The most accurate and innovative predictions will be handsomely rewarded.\n\nAre you ready to decode the crowd and become the Sentiment Master? Join now and let your insights shine!`,
    categories: ["SOCIAL", "SENTIMENT"],
    tags: ["DATE"],
    rewards: ["500 USDC"],
    startDate: addDays(new Date(), 2),
    endDate: addDays(new Date(), 3),
    status: "pending",
    minStaked: 100,
  },
];

export const endedCompetitions: Competition[] = [
  {
    id: "ended-1",
    name: "Competition 1",
    description: "Competition 1",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 2),
    endDate: subDays(new Date(), 1),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-2",
    name: "Competition 2",
    description: "Competition 2",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 3),
    endDate: subDays(new Date(), 2),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-3",
    name: "Competition 3",
    description: "Competition 3",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 4),
    endDate: subDays(new Date(), 3),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-4",
    name: "Competition 4",
    description: "Competition 4",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 5),
    endDate: subDays(new Date(), 4),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-5",
    name: "Competition 5",
    description: "Competition 5",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 6),
    endDate: subDays(new Date(), 5),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-6",
    name: "Competition 6",
    description: "Competition 6",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 7),
    endDate: subDays(new Date(), 6),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-7",
    name: "Competition 7",
    description: "Competition 7",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 8),
    endDate: subDays(new Date(), 7),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-8",
    name: "Competition 8",
    description: "Competition 8",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 9),
    endDate: subDays(new Date(), 8),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-9",
    name: "Competition 9",
    description: "Competition 9",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 10),
    endDate: subDays(new Date(), 9),
    status: "completed",
    minStaked: 100,
  },
  {
    id: "ended-10",
    name: "Competition 10",
    description: "Competition 10",
    categories: ["FINANCE", "CRYPTO-TRADING"],
    tags: [],
    rewards: [],
    winners: ["AGENT NAME"],
    startDate: subDays(new Date(), 11),
    endDate: subDays(new Date(), 10),
    status: "completed",
    minStaked: 100,
  },
];
