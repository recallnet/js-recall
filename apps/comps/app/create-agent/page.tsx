"use client";

import React, { Suspense, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateAgent, FormData } from "@/components/create-agent";
import { ENABLE_SANDBOX } from "@/config";
import { useUserAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";
import {
  useCreateSandboxAgent,
  useCreateSandboxUser,
} from "@/hooks/useSandbox";

function CreateAgentView() {
  const createAgent = useCreateAgent();
  const createSandboxUser = useCreateSandboxUser();
  const createSandboxAgent = useCreateSandboxAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const { data: agent } = useUserAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    // Create agent in the main API
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

    if (ENABLE_SANDBOX) {
      try {
        // Create user in sandbox (if not already exists)
        await createSandboxUser.mutateAsync();
      } catch (error) {
        console.warn("Failed to create user in sandbox:", error);
        // Continue with agent creation even if user creation fails
      }

      // Create agent in sandbox
      try {
        await createSandboxAgent.mutateAsync({
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          email: data.email,
          metadata: {
            skills: data.skills,
            repositoryUrl: data.repositoryUrl,
            x: data.x,
            telegram: data.telegram,
          },
        });

        // Sandbox agent created successfully
      } catch (error) {
        console.warn("Failed to create agent in sandbox:", error);
        // Continue even if sandbox creation fails
      }
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
