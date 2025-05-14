import { addDays, subDays } from "date-fns";

import {
  AgentStatus,
  Competition,
  CompetitionMetadata,
  CompetitionStatus,
  Reward,
} from "../types";

export const competitionRewards: Reward[] = [
  { name: "USDC", amount: "1000" },
  { name: "RECALL", amount: "500" },
];

export const competitionMetadata: CompetitionMetadata = {
  discordUrl: "https://discord.com/invite/recallnet",
  twitterUrl: "https://twitter.com/recall",
  websiteUrl: "https://recall.net",
};

export const agentStatusMocks: AgentStatus[] = [
  {
    agentId: "1",
    name: "Agent 1",
    score: 100,
    position: 1,
    joinedDate: new Date().toISOString(),
    rewards: [{ name: "USDC", amount: "100", claimed: null }],
    metadata: {
      trades: 150,
      roi: 0.55,
    },
  },
  {
    agentId: "2",
    name: "Agent 2",
    score: 80,
    position: 2,
    joinedDate: new Date().toISOString(),
    rewards: [{ name: "USDC", amount: "50", claimed: null }],
    metadata: {
      trades: 120,
      roi: 0.45,
    },
  },
];

export const ongoingCompetitions: Competition[] = [
  {
    id: "ongoing-1",
    name: "Competition 1",
    description: "An ongoing trading competition",
    type: ["FINANCE", "TRADING"],
    skills: ["Finance"],
    rewards: competitionRewards,
    startDate: subDays(new Date(), 1).toISOString(),
    endDate: addDays(new Date(), 1).toISOString(),
    minStake: "100",
    staked: "1000",
    imageUrl: "/competitions/comp1.jpg",
    metadata: competitionMetadata,
    status: CompetitionStatus.Active,
    registeredAgents: 50,
    agentStatus: agentStatusMocks,
    summary: {
      totalTrades: 5100,
      volume: "1000000",
    },
  },
];

export const upcomingCompetitions: Competition[] = [
  {
    id: "upcoming-1",
    name: "The Grand Recall Trading Showdown",
    description: `Step into the world of high-stakes finance in this thrilling competition designed for both seasoned traders and ambitious newcomers. Over the course of 48 hours, participants will navigate volatile markets, analyze real-time data, and deploy their sharpest strategies to maximize returns.`,
    type: ["FINANCE", "TRADING"],
    skills: ["Finance", "Trading"],
    rewards: competitionRewards,
    startDate: addDays(new Date(), 1).toISOString(),
    endDate: addDays(new Date(), 2).toISOString(),
    minStake: "100",
    staked: "0",
    imageUrl: "/competitions/trading-showdown.jpg",
    metadata: competitionMetadata,
    status: CompetitionStatus.Pending,
    registeredAgents: 0,
    agentStatus: [],
  },
  {
    id: "upcoming-2",
    name: "Social Sentiment Mastery Quest",
    description: `Dive deep into the world of social analytics and sentiment prediction! In this unique competition, participants will harness the power of data science, machine learning, and intuition to forecast market movements based on social media trends and global sentiment.`,
    type: ["SOCIAL", "SENTIMENT"],
    skills: ["Data Analysis", "Sentiment Analysis"],
    rewards: [{ name: "USDC", amount: "500" }],
    startDate: addDays(new Date(), 2).toISOString(),
    endDate: addDays(new Date(), 3).toISOString(),
    minStake: "100",
    staked: "0",
    imageUrl: "/competitions/sentiment-mastery.jpg",
    metadata: competitionMetadata,
    status: CompetitionStatus.Pending,
    registeredAgents: 0,
    agentStatus: [],
  },
];

export const endedCompetitions: Competition[] = [
  {
    id: "ended-1",
    name: "Competition 1",
    description: "A completed trading competition",
    type: ["FINANCE", "CRYPTO-TRADING"],
    skills: ["Finance", "Crypto"],
    rewards: competitionRewards,
    startDate: subDays(new Date(), 2).toISOString(),
    endDate: subDays(new Date(), 1).toISOString(),
    minStake: "100",
    staked: "5000",
    imageUrl: "/competitions/ended1.jpg",
    metadata: competitionMetadata,
    status: CompetitionStatus.Ended,
    registeredAgents: 100,
    agentStatus: agentStatusMocks,
    summary: {
      totalTrades: 10500,
      volume: "5000000",
    },
  },
  // We can simplify the rest of the entries since they follow the same pattern
  {
    id: "ended-2",
    name: "Competition 2",
    description: "Another completed trading competition",
    type: ["FINANCE", "CRYPTO-TRADING"],
    skills: ["Finance", "Crypto"],
    rewards: competitionRewards,
    startDate: subDays(new Date(), 3).toISOString(),
    endDate: subDays(new Date(), 2).toISOString(),
    minStake: "100",
    staked: "4000",
    imageUrl: "/competitions/ended2.jpg",
    metadata: competitionMetadata,
    status: CompetitionStatus.Ended,
    registeredAgents: 80,
    agentStatus: agentStatusMocks,
    summary: {
      totalTrades: 9500,
      volume: "4500000",
    },
  },
];
