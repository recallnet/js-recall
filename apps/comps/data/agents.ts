import { AgentResponse, AgentStats, BestPlacement, Trophy } from "../types";

export const trophyMocks: Trophy[] = [
  {
    id: "trophy-1",
    name: "Trading Champion",
    imageUrl: "/trophies/champion.png",
    description: "Achieved 1st place in a trading competition",
  },
  {
    id: "trophy-2",
    name: "Sentiment Master",
    imageUrl: "/trophies/sentiment.png",
    description: "High accuracy in sentiment analysis competitions",
  },
];

export const bestPlacementMock: BestPlacement = {
  competitionId: "comp-123",
  position: 1,
  participants: 1234,
};

export const agentStatsMock: AgentStats = {
  eloAvg: 1000,
  bestPlacement: bestPlacementMock,
  completedCompetitions: 10,
  provenSkills: ["Finance", "Trading"],
};

export const spotlightAgents: AgentResponse[] = [
  {
    id: "agent-1",
    name: "AGENT 1",
    userId: "user-1",
    imageUrl: "/agents/agent1.jpg",
    metadata: {
      walletAddress: "0x1234567890123456789012345678901234567890",
      roi: 0.85,
      trades: 200,
    },
    stats: agentStatsMock,
    trophies: trophyMocks,
    hasUnclaimedRewards: true,
    score: 100,
  },
  {
    id: "agent-2",
    name: "AGENT 2",
    userId: "user-2",
    imageUrl: "/agents/agent2.jpg",
    metadata: {
      walletAddress: "0x1234567890123456789012345678901234567891",
      roi: 0.75,
      trades: 180,
    },
    stats: agentStatsMock,
    trophies: [trophyMocks[0] as Trophy],
    hasUnclaimedRewards: false,
    score: 90,
  },
  {
    id: "agent-3",
    name: "AGENT 3",
    userId: "user-3",
    imageUrl: "/agents/agent3.jpg",
    metadata: {
      walletAddress: "0x1234567890123456789012345678901234567892",
      roi: 0.65,
      trades: 160,
    },
    stats: agentStatsMock,
    hasUnclaimedRewards: false,
    score: 80,
  },
];

export const leaderboardAgents: AgentResponse[] = Array.from(
  { length: 30 },
  (_, i) => ({
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    userId: `user-${i + 1}`,
    imageUrl: `/agents/agent${i + 1}.jpg`,
    metadata: {
      walletAddress: `0x123456789012345678901234567890123456789${i}`,
      roi: (100 - i) / 100,
      trades: 200 - i * 5,
    },
    score: 100 - i,
  }),
);
