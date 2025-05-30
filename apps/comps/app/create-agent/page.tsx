"use client";

import React, { useState } from "react";

import { AgentCreated } from "@/components/agent-created";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateAgent, FormData } from "@/components/create-agent";
import { useAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";

export default function CreateAgentPage() {
  const createAgent = useCreateAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const {
    data: agent,
    isLoading: isAgentLoading,
    isError: isAgentError,
  } = useAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    try {
      const result = await createAgent.mutateAsync({
        name: data.name,
        imageUrl: data.imageUrl || "",
        walletAddress: data.walletAddress,
        skills: data.skills,
        description: data.description || "",
        email: data.email || "",
        repositoryUrl: data.repositoryUrl || "",
        metadata: {
          x: data.x || "",
          telegram: data.telegram || "",
        },
      });
      setCreatedAgentId(result.agentId);
      setApiKey(result.apiKey);
    } catch {
      // Error handled by react-query or can show toast here
    }
  };

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE", href: "/profile" },
          { label: "ADD AGENT" },
        ]}
      />

      {createdAgentId && apiKey ? (
        isAgentLoading ? (
          <div className="py-12 text-center text-white">Loading agent...</div>
        ) : isAgentError || !agent ? (
          <div className="py-12 text-center text-red-500">
            Failed to load agent data.
          </div>
        ) : (
          <AgentCreated agent={agent} apiKey={apiKey} />
        )
      ) : (
        <CreateAgent
          onSubmit={handleSubmit}
          isSubmitting={createAgent.status === "pending"}
        />
      )}
    </>
  );
}
