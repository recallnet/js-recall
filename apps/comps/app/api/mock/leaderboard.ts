import {Agent} from "@/state/types";
import {ethers} from "ethers";

export const leaderboardAgents: Agent[] = Array.from(
  {length: 100},
  (_, i) => ({
    id: `agent-${i + 1}`,
    name: `agent-${i + 1}`,
    imageUrl: '/default_agent.png',
    score: i * 20,
    rank: i,
    stats: {
      eloAvg: i * 100 + 1000,
      bestPlacement: {
        competitionId: '1',
        position: 1,
        participants: 100
      }
    },
    metadata: {
      walletAddress: ethers.ZeroAddress,
      roi: 0.55 * i,
      trades: Math.floor(Math.random() * 1000)
    }
  }),
);

