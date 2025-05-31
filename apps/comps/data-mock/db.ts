import { v4 as uuidv4 } from "uuid";

import { agents, competitions } from "@/data-mock/fixtures";
import { Agent, Competition, CreateAgentRequest } from "@/types";

interface Store {
  agents: Agent[];
  competitions: Competition[];
}

let store: Store;

if (process.env.NODE_ENV === "production") {
  store = {
    agents: [...agents],
    competitions: [...competitions],
  };
} else {
  const globalStore = (global as any).store;
  if (!globalStore) {
    (global as any).store = {
      agents: [...agents],
      competitions: [...competitions],
    };
  }
  store = (global as any).store;
}

export { store };

// Competition helpers
export const findCompetition = (id: string): Competition | undefined => {
  return store.competitions.find((c) => c.id === id);
};

export const filterCompetitions = (
  filter?: Record<string, string>,
): Competition[] => {
  if (!filter) return [...store.competitions];

  return store.competitions.filter((comp) => {
    return Object.entries(filter).every(([key, value]) => {
      const compValue = comp[key as keyof Competition];
      if (Array.isArray(compValue)) {
        // Handle arrays - check if any element matches
        return compValue.some((v) => {
          if (typeof v === "object" && v !== null) {
            // For objects in arrays, we might need more specific handling
            return false;
          }
          return String(v) === value;
        });
      }
      // For non-arrays, simply compare string values
      return String(compValue) === value;
    });
  });
};

export const addCompetition = (competition: Competition): Competition => {
  store.competitions.push(competition);
  return competition;
};

export const updateCompetition = (
  id: string,
  updates: Partial<Competition>,
): Competition | undefined => {
  const index = store.competitions.findIndex((c) => c.id === id);
  if (index === -1) return undefined;

  store.competitions[index] = {
    ...store.competitions[index],
    ...updates,
  } as Competition;
  return store.competitions[index];
};

export const deleteCompetition = (id: string): boolean => {
  const index = store.competitions.findIndex((c) => c.id === id);
  if (index === -1) return false;

  store.competitions.splice(index, 1);
  return true;
};

// Agent helpers
export const findAgent = (id: string): Agent | undefined => {
  return store.agents.find((a) => a.id === id);
};

export const filterAgents = (filter?: Record<string, string>): Agent[] => {
  if (!filter) return [...store.agents];

  return store.agents.filter((agent) => {
    return Object.entries(filter).every(([key, value]) => {
      const keyPath = key.split(".");

      // Handle nested properties like 'metadata.walletAddress'
      if (keyPath.length > 1) {
        let currentValue: any = agent;
        for (const part of keyPath) {
          if (currentValue === undefined || currentValue === null) {
            return false;
          }
          currentValue = currentValue[part as keyof typeof currentValue];
        }
        return String(currentValue) === value;
      }

      // Handle direct properties
      const agentValue = agent[key as keyof Agent];

      // Handle arrays (like trophies or skills)
      if (Array.isArray(agentValue)) {
        return agentValue.some((item) => {
          if (typeof item === "string") {
            return item === value;
          }
          // For complex objects in arrays, we'd need more specific handling
          return false;
        });
      }

      // For direct comparisons of non-array values
      return String(agentValue) === value;
    });
  });
};

export const findAgentsByCompetition = (competitionId: string): Agent[] => {
  return store.agents.filter((agent) =>
    agent.registeredCompetitionIds?.includes(competitionId),
  );
};

export const findCompetitionsByAgent = (agentId: string): Competition[] => {
  return store.competitions.filter((competition) =>
    competition.registeredAgentIds?.includes(agentId),
  );
};

export const addAgent = (agent: CreateAgentRequest, userId: string): Agent => {
  const newAgent: Agent = {
    id: uuidv4(),
    imageUrl: agent.imageUrl || "/agent-placeholder.png",
    name: agent.name,
    ownerId: userId,
    apiKey: uuidv4(),
    metadata: {
      walletAddress: agent.walletAddress,
      email: agent.email,
      repositoryUrl: agent.repositoryUrl,
      description: agent.description,
    },
    registeredCompetitionIds: [],
    skills: agent.skills,
    description: "",
    status: "",
  };

  store.agents.push(newAgent);

  return newAgent;
};

export const updateAgent = (
  id: string,
  updates: Partial<Agent>,
): Agent | undefined => {
  const index = store.agents.findIndex((a) => a.id === id);
  if (index === -1) return undefined;

  store.agents[index] = { ...store.agents[index], ...updates } as Agent;
  return agents[index];
};

export const deleteAgent = (id: string): boolean => {
  const index = store.agents.findIndex((a) => a.id === id);
  if (index === -1) return false;

  store.agents.splice(index, 1);
  return true;
};
