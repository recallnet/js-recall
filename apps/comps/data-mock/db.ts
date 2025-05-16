import { Agent, Competition } from "../types";
import { agents, competitions } from "./fixtures";

// Competition helpers
export const findCompetition = (id: string): Competition | undefined => {
  return competitions.find((c) => c.id === id);
};

export const filterCompetitions = (
  filter?: Record<string, string>,
): Competition[] => {
  if (!filter) return [...competitions];

  return competitions.filter((comp) => {
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
  competitions.push(competition);
  return competition;
};

export const updateCompetition = (
  id: string,
  updates: Partial<Competition>,
): Competition | undefined => {
  const index = competitions.findIndex((c) => c.id === id);
  if (index === -1) return undefined;

  competitions[index] = { ...competitions[index], ...updates } as Competition;
  return competitions[index];
};

export const deleteCompetition = (id: string): boolean => {
  const index = competitions.findIndex((c) => c.id === id);
  if (index === -1) return false;

  competitions.splice(index, 1);
  return true;
};

// Agent helpers
export const findAgent = (id: string): Agent | undefined => {
  return agents.find((a) => a.id === id);
};

export const filterAgents = (filter?: Record<string, string>): Agent[] => {
  if (!filter) return [...agents];

  return agents.filter((agent) => {
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
  return agents.filter((agent) =>
    agent.registeredCompetitionIds?.includes(competitionId),
  );
};

export const findCompetitionsByAgent = (agentId: string): Competition[] => {
  return competitions.filter((competition) =>
    competition.registeredAgentIds?.includes(agentId),
  );
};

export const addAgent = (agent: Agent): Agent => {
  agents.push(agent);
  return agent;
};

export const updateAgent = (
  id: string,
  updates: Partial<Agent>,
): Agent | undefined => {
  const index = agents.findIndex((a) => a.id === id);
  if (index === -1) return undefined;

  agents[index] = { ...agents[index], ...updates } as Agent;
  return agents[index];
};

export const deleteAgent = (id: string): boolean => {
  const index = agents.findIndex((a) => a.id === id);
  if (index === -1) return false;

  agents.splice(index, 1);
  return true;
};
