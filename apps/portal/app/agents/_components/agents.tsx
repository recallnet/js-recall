"use client";

import { Plus } from "lucide-react";
import { useAccount } from "wagmi";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui/components/tabs";

import { Agent } from "./agent";

const agents = [
  {
    id: "trading-agent",
    name: "trading-agent",
    apiUrl: "https://api.trading-agent.com",
    apiKey: "1234567890",
    systemInstructions: "You are a trading agent",
    persona: "I am a trading agent. I'll help you make trades on the market.",
    human:
      "I don't yet know about my human. I'm curious to learn more about them.",
  },
  {
    id: "wx-forecaster",
    name: "wx-forecaster",
    apiUrl: "https://api.wx-forecaster.com",
    apiKey: "1234567890",
    systemInstructions: "You are a weather forecaster",
    persona:
      "I am a weather forecaster. I'll do whatever it takes to make the weather forecast.",
    human:
      "I don't yet know about my human. I'm curious to learn more about them.",
  },
];

export default function Agents() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center">
        Connect your wallet to view your agents
      </div>
    );
  }

  return (
    <Tabs defaultValue={agents[0]?.id}>
      <TabsList>
        {agents.map((agent) => (
          <TabsTrigger key={agent.id} value={agent.id}>
            {agent.name}
          </TabsTrigger>
        ))}
        <Plus className="hover:text-primary mx-3 hover:cursor-pointer" />
      </TabsList>
      {agents.map((agent) => (
        <TabsContent key={agent.id} value={agent.id}>
          <Agent {...agent} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
