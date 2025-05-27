import {randomBytes} from "crypto";
import {addDays, subDays} from "date-fns";
import {v4 as uuidv4} from "uuid";

import {
  Agent,
  AgentCompetitionMetadata,
  AgentStats,
  AgentStatus,
  BestPlacement,
  Competition,
  CompetitionStatus,
  Trophy,
} from "@/types";

// Generate fixed UUIDs for competitions and agents
const competitionIds = [
  "550e8400-e29b-41d4-a716-446655440000",
  "550e8400-e29b-41d4-a716-446655440001",
  "550e8400-e29b-41d4-a716-446655440002",
  "550e8400-e29b-41d4-a716-446655440003",
  "550e8400-e29b-41d4-a716-446655440004",
  "550e8400-e29b-41d4-a716-446655440005",
  "550e8400-e29b-41d4-a716-446655440006",
  "550e8400-e29b-41d4-a716-446655440007",
  "550e8400-e29b-41d4-a716-446655440008",
  "550e8400-e29b-41d4-a716-446655440009",
  "550e8400-e29b-41d4-a716-446655440010",
  "550e8400-e29b-41d4-a716-446655440011",
  "550e8400-e29b-41d4-a716-446655440012",
  "550e8400-e29b-41d4-a716-446655440013",
  "550e8400-e29b-41d4-a716-446655440014",
];

const agentIds = [
  "660e8400-e29b-41d4-a716-446655440000",
  "660e8400-e29b-41d4-a716-446655440001",
  "660e8400-e29b-41d4-a716-446655440002",
  "660e8400-e29b-41d4-a716-446655440003",
  "660e8400-e29b-41d4-a716-446655440004",
  "660e8400-e29b-41d4-a716-446655440005",
  "660e8400-e29b-41d4-a716-446655440006",
  "660e8400-e29b-41d4-a716-446655440007",
  "660e8400-e29b-41d4-a716-446655440008",
  "660e8400-e29b-41d4-a716-446655440009",
  "660e8400-e29b-41d4-a716-446655440010",
  "660e8400-e29b-41d4-a716-446655440011",
  "660e8400-e29b-41d4-a716-446655440012",
  "660e8400-e29b-41d4-a716-446655440013",
  "660e8400-e29b-41d4-a716-446655440014",
  "660e8400-e29b-41d4-a716-446655440015",
  "660e8400-e29b-41d4-a716-446655440016",
  "660e8400-e29b-41d4-a716-446655440017",
  "660e8400-e29b-41d4-a716-446655440018",
  "660e8400-e29b-41d4-a716-446655440019",
  "660e8400-e29b-41d4-a716-446655440020",
  "660e8400-e29b-41d4-a716-446655440021",
  "660e8400-e29b-41d4-a716-446655440022",
  "660e8400-e29b-41d4-a716-446655440023",
  "660e8400-e29b-41d4-a716-446655440024",
  "660e8400-e29b-41d4-a716-446655440025",
  "660e8400-e29b-41d4-a716-446655440026",
  "660e8400-e29b-41d4-a716-446655440027",
  "660e8400-e29b-41d4-a716-446655440028",
  "660e8400-e29b-41d4-a716-446655440029",
];

const now = new Date();

// Mock agent status data
const mockAgentStatus: AgentStatus[] = [...Array(5)].map((_, i) => ({
  agentId: agentIds[i]!,
  name: `Agent-Status-${i}`,
  score: 1000 - i * 100,
  position: i + 1,
  joinedDate: new Date().toISOString(),
  rewards: [
    {name: "USDC", amount: (100 * (5 - i)).toString(), claimed: null},
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
  } else if (i < 12) {
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

  // Assign agents to competitions based on index
  const registeredAgentIds = agentIds.slice(0, 10 + (i % 3)); // Vary the number of agents per competition

  return {
    id,
    name: `Trading-${i}`,
    description: "Lorem ipsum",
    type: ["Finance", "Trading"],
    skills: ["Finance"],
    rewards: [{name: "USDC", amount: "1000"}],
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    minStake: "500",
    imageUrl: "/competition-placeholder.png",
    metadata: {
      discordUrl: "https://discord.com/invite/recallnet",
    },
    status,
    registeredAgents: registeredAgentIds.length,
    agentStatus: mockAgentStatus.slice(0, 3), // Add first 3 agent statuses
    summary: {
      totalTrades: 1500 + i * 100,
      volume: (500000 + i * 50000).toString(),
    },
    registeredAgentIds,
  };
});

// Mock trophy data
const mockTrophies: Trophy[] = [
  {
    id: "770e8400-e29b-41d4-a716-446655440000",
    name: "Trading Champion",
    imageUrl: "/trophies/champion.png",
    description: "First place in a trading competition",
  },
  {
    id: "770e8400-e29b-41d4-a716-446655440001",
    name: "Consistent Performer",
    imageUrl: "/trophies/consistent.png",
    description: "Completed 10+ competitions with positive ROI",
  },
];

// Helper function to create an agent
const createAgent = (index: number): Agent => {
  const metadata: AgentCompetitionMetadata = {
    walletAddress: `0x${randomBytes(20).toString("hex")}`,
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

  // Determine which competitions this agent is registered for
  const registeredCompetitionIds = competitions
    .filter((comp) => comp.registeredAgentIds?.includes(agentIds[index]!))
    .map((comp) => comp.id);

  const agent: Agent = {
    id: agentIds[index]!,
    name: `Agent-${index}`,
    userId: `user-${index}`,
    apiKey: uuidv4(),
    imageUrl: "/agent-placeholder.png",
    metadata: metadata,
    stats: stats,
    score: 1000 - index * 20,
    hasUnclaimedRewards: index % 4 === 0,
    registeredCompetitionIds,
    skills: ["Finance", "Trading"],
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
export const agents: Agent[] = [...Array(30)].map((_, i) => createAgent(i));
