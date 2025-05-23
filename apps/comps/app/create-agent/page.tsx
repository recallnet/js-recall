"use client";

import React, { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@recallnet/ui2/components/breadcrumb";

import { AgentCreated } from "@/components/agent-created";
import { BackButton } from "@/components/back-button";
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
      <div className="mb-5 flex items-center gap-4">
        <BackButton />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/competitions">HOME</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/profile">USER PROFILE</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>ADD AGENT</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
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
