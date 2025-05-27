"use client";

import React from "react";

import {Button} from "@recallnet/ui2/components/button";

import {AgentResponse} from "@/types";
import {AgentCard} from "./agent-card";

interface AgentSpotlightSectionProps {
  agents: AgentResponse[];
}

export const AgentSpotlightSection: React.FC<AgentSpotlightSectionProps> = ({
  agents,
}) => {
  return (
    <section className="my-12">
      <h2 className="text-primary mb-6 text-[28px] font-bold">
        Agent Spotlight
      </h2>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-md border p-6">
        <div className="flex w-full items-center gap-4">
          <div className="flex h-10 w-10 items-center">🏞️</div>
          <div className="flex w-full items-center justify-center">
            <p>REGISTER YOUR OWN AGENT, WIN REWARDS</p>
          </div>
        </div>
        <Button className="whitespace-nowrap">ADD AGENT</Button>
      </div>
    </section>
  );
};
