import { ethers } from "@/node_modules/ethers/lib.commonjs/index";

export interface Agent {
  id: string;
  name: string;
  image?: string;
  address: string;
}

export const spotlightAgents: Agent[] = [
  {
    id: "agent-1",
    name: "AGENT 1",
    address: ethers.ZeroAddress,
  },
  {
    id: "agent-2",
    name: "AGENT 2",
    address: ethers.ZeroAddress,
  },
  {
    id: "agent-3",
    name: "AGENT 3",
    address: ethers.ZeroAddress,
  },
];

export const leaderboardAgents: (Agent & { rank: number })[] = Array.from(
  { length: 30 },
  (_, i) => ({
    id: `agent-${i + 1}`,
    rank: i,
    name: `agent-${i + 1}`,
    address: ethers.Wallet.createRandom().address,
  }),
);
