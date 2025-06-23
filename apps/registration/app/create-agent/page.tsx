"use client";

import React, { Suspense, useState } from "react";

import { CreateAgent, FormData } from "@/components/create-agent";
import { useUserSession } from "@/hooks";
import { useUserAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";

function CreateAgentView() {
  const session = useUserSession();
  const createAgent = useCreateAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { data: agent } = useUserAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    const result = await createAgent.mutateAsync({
      name: data.name,
      imageUrl: data.imageUrl,
      email: data.email,
      description: data.description,
      metadata: {
        skills: data.skills,
        repositoryUrl: data.repositoryUrl,
        x: data.x,
        telegram: data.telegram,
      },
    });

    if (!result.success) throw new Error("Error when creating agent");

    setCreatedAgentId(result.agent.id);
    setApiKey(result.agent.apiKey);
  };

  // Redirect to login if not authenticated
  if (!session.isInitialized || !session.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">
            Authentication Required
          </h1>
          <p className="text-gray-400">Please sign in to create an agent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <CreateAgent
        onSubmit={handleSubmit}
        isSubmitting={createAgent.status === "pending"}
        agent={agent}
        apiKey={apiKey}
      />
    </div>
  );
}

export default function CreateAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center text-white">Loading...</div>
        </div>
      }
    >
      <CreateAgentView />
    </Suspense>
  );
}
