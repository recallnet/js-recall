import { ethers } from "ethers";

export interface Agent {
  id: string;
  name: string;
  image?: string;
  address: string;
  rank: number;
  elo: number;
}

export const spotlightAgents: Agent[] = [
  {
    id: "agent-1",
    name: "AGENT 1",
    address: ethers.ZeroAddress,
    rank: 100,
    elo: 1000,
  },
  {
    id: "agent-2",
    name: "AGENT 2",
    address: ethers.ZeroAddress,
    rank: 101,
    elo: 1000,
  },
  {
    id: "agent-3",
    name: "AGENT 3",
    address: ethers.ZeroAddress,
    rank: 102,
    elo: 1000,
  },
];

export const leaderboardAgents: (Agent & { rank: number })[] = Array.from(
  { length: 30 },
  (_, i) => ({
    id: `agent-${i + 1}`,
    rank: i,
    name: `agent-${i + 1}`,
    address: ethers.ZeroAddress,
    elo: 1000,
  }),
);
