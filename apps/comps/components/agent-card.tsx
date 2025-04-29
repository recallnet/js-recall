"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import React from "react";

import { Agent } from "../data/agents";

interface AgentCardProps {
  agent: Agent;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  return (
    <div className="bg-card flex h-52 items-end justify-between p-6">
      <h3 className="text-primary text-lg font-bold">{agent.name}</h3>
      <button
        className="rounded-full p-1.5 hover:bg-slate-700"
        aria-label="View agent details"
      >
        <ChevronRightIcon className="text-primary h-5 w-5" />
      </button>
    </div>
  );
};
