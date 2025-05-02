export interface Agent {
  id: string;
  name: string;
  image?: string;
}

export const spotlightAgents: Agent[] = [
  {
    id: "agent-1",
    name: "AGENT 1",
  },
  {
    id: "agent-2",
    name: "AGENT 2",
  },
  {
    id: "agent-3",
    name: "AGENT 3",
  },
];
