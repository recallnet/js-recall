import { addDays, parseISO, subDays } from "date-fns";
import { v4 as uuid } from "uuid";

import {
  Agent,
  AgentCompetitionMetadata,
  AgentResponse,
  AgentStats,
  AgentStatus,
  BestPlacement,
  Competition,
  CompetitionStatus,
  Trophy,
} from "../types";

// Generate fixed IDs for competitions
const competitionIds = [...Array(20)].map(() => uuid());
const now = new Date();

// Mock agent status data
const mockAgentStatus: AgentStatus[] = [...Array(5)].map((_, i) => ({
  agentId: uuid(),
  name: `Agent-Status-${i}`,
  score: 1000 - i * 100,
  position: i + 1,
  joinedDate: new Date().toISOString(),
  rewards: [
    { name: "USDC", amount: (100 * (5 - i)).toString(), claimed: null },
  ],
  metadata: {
    trades: 150 - i * 10,
    roi: 0.65 - i * 0.05,
  },
}));

// Create competition fixtures with different statuses based on dates
export const competitions: Competition[] = competitionIds.map((id, i) => {
  // Determine competition status and dates based on index
  let status: CompetitionStatus;
  let startDate: Date;
  let endDate: Date;

  if (i < 7) {
    // Active competitions (current)
    status = CompetitionStatus.Active;
    startDate = subDays(now, 3 + i);
    endDate = addDays(now, 7 + i);
  } else if (i < 14) {
    // Ended competitions (past)
    status = CompetitionStatus.Ended;
    startDate = subDays(now, 30 + i);
    endDate = subDays(now, 1 + i);
  } else {
    // Pending competitions (future)
    status = CompetitionStatus.Pending;
    startDate = addDays(now, 3 + i);
    endDate = addDays(now, 14 + i * 2);
  }

  return {
    id,
    name: `Trading-${i}`,
    description: "Lorem ipsum",
    type: ["Finance", "Trading"],
    skills: ["Finance"],
    rewards: [{ name: "USDC", amount: "1000" }],
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    minStake: "500",
    staked: "7000",
    imageUrl: "/img/placeholder.png",
    metadata: {
      discordUrl: "https://discord.com/invite/recallnet",
    },
    status,
    registeredAgents: 10,
    agentStatus: mockAgentStatus.slice(0, 3), // Add first 3 agent statuses
    summary: {
      totalTrades: 1500 + i * 100,
      volume: (500000 + i * 50000).toString(),
    },
  };
});

// Mock trophy data
const mockTrophies: Trophy[] = [
  {
    id: uuid(),
    name: "Trading Champion",
    imageUrl: "/trophies/champion.png",
    description: "First place in a trading competition",
  },
  {
    id: uuid(),
    name: "Consistent Performer",
    imageUrl: "/trophies/consistent.png",
    description: "Completed 10+ competitions with positive ROI",
  },
];

// Helper function to create an agent
const createAgent = (index: number): AgentResponse => {
  const metadata: AgentCompetitionMetadata = {
    walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
    roi: 0.5 + Math.random() * 0.5,
    trades: 100 + Math.floor(Math.random() * 150),
  };

  const stats: AgentStats = {
    eloAvg: 1000 + index * 50,
    completedCompetitions: Math.floor(Math.random() * 15),
    provenSkills: ["Finance", "Trading"],
  };

  // Only add bestPlacement for first 3 agents
  if (index < 3) {
    const bestPlacement: BestPlacement = {
      competitionId: competitionIds[index]!, // Non-null assertion, we know the first 3 exist
      position: index + 1,
      participants: 100,
    };
    stats.bestPlacement = bestPlacement;
  }

  const agent: AgentResponse = {
    id: uuid(),
    name: `Agent-${index}`,
    userId: `user-${index}`,
    imageUrl: "/img/agent-placeholder.png",
    metadata: metadata,
    stats: stats,
    score: 1000 - index * 20,
    hasUnclaimedRewards: index % 4 === 0,
  };

  // Add trophies conditionally
  if (index < 3) {
    agent.trophies = [mockTrophies[0] as Trophy, mockTrophies[1] as Trophy];
  } else if (index < 7) {
    agent.trophies = [mockTrophies[1] as Trophy];
  }

  return agent;
};

// Create agents
export const agents: Agent[] = [...Array(15)].map((_, i) => createAgent(i));
