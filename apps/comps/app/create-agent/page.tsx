"use client";

import React, { Suspense, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateAgent, FormData } from "@/components/create-agent";
import { useUserAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";

function CreateAgentView() {
  const createAgent = useCreateAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { data: agent } = useUserAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    try {
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
      <CreateAgent
        onSubmit={handleSubmit}
        isSubmitting={createAgent.status === "pending"}
        agent={agent}
        apiKey={apiKey}
      />
    </AuthGuard>
  );
}

export default function CreateAgentPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-white">Loading...</div>}
    >
      <CreateAgentView />
    </Suspense>
  );
}
