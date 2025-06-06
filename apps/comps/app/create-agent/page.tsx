"use client";

import React, { useState } from "react";

import { AgentCreated } from "@/components/agent-created";
import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateAgent, FormData } from "@/components/create-agent";
import { useUserAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";
import { useRedirectTo } from "@/hooks/useRedirectTo";

export default function CreateAgentPage() {
  const createAgent = useCreateAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { redirectToUrl } = useRedirectTo("/profile");

  const {
    data: agent,
    isLoading: isAgentLoading,
    isError: isAgentError,
  } = useUserAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    try {
      const result = await createAgent.mutateAsync({
        name: data.name,
        imageUrl: data.imageUrl,
        email: data.email,
        description: data.description,
        metadata: {
          walletAddress: data.walletAddress,
          skills: JSON.stringify(data.skills),
          repositoryUrl: data.repositoryUrl,
          x: data.x,
          telegram: data.telegram,
        },
      });

      if (!result.success) throw new Error("Error when creating agent");

      setCreatedAgentId(result.agent.id);
      setApiKey(result.agent.apiKey);
    } catch {
      // Error handled by react-query or can show toast here
    }
  };

  return (
    <AuthGuard>
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
          <AgentCreated
            agent={agent}
            apiKey={apiKey}
            redirectToUrl={redirectToUrl}
          />
        )
      ) : (
        <CreateAgent
          onSubmit={handleSubmit}
          isSubmitting={createAgent.status === "pending"}
        />
      )}
    </AuthGuard>
  );
}
