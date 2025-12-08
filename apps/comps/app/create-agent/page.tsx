"use client";

import React, { Suspense, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateAgent, FormData } from "@/components/create-agent";
import { config } from "@/config/public";
import { useUserAgent } from "@/hooks/useAgent";
import { useCreateAgent } from "@/hooks/useCreateAgent";
import {
  useCreateSandboxAgent,
  useCreateSandboxUser,
} from "@/hooks/useSandbox";
import { useSession } from "@/hooks/useSession";

function CreateAgentView() {
  const { backendUser } = useSession();
  const createAgent = useCreateAgent();
  const createSandboxUser = useCreateSandboxUser();
  const createSandboxAgent = useCreateSandboxAgent();
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const { data: agent } = useUserAgent(createdAgentId || undefined);

  const handleSubmit = async (data: FormData) => {
    // Create agent in the main API
    const result = await createAgent.mutateAsync({
      name: data.name,
      handle: data.handle,
      imageUrl: data.imageUrl,
      description: data.description,
      metadata: {
        skills: data.skills,
        repositoryUrl: data.repositoryUrl,
        x: data.x,
        telegram: data.telegram,
      },
    });

    setCreatedAgentId(result.agent.id);

    if (config.publicFlags.enableSandbox && backendUser) {
      try {
        // Create user in sandbox (if not already exists)
        await createSandboxUser.mutateAsync({
          walletAddress: backendUser.walletAddress,
          email: backendUser.email ?? "",
          name: backendUser.name ?? undefined,
          imageUrl: backendUser.imageUrl ?? undefined,
          metadata: backendUser.metadata ?? undefined,
          privyId: backendUser.privyId ?? undefined,
          embeddedWalletAddress: backendUser.embeddedWalletAddress ?? undefined,
        });
      } catch (error) {
        console.warn("Failed to create user in sandbox:", error);
        // Continue with agent creation even if user creation fails
      }

      // Create agent in sandbox
      try {
        if (!backendUser?.walletAddress) {
          throw new Error("User wallet address not found");
        }

        await createSandboxAgent.mutateAsync({
          user: {
            walletAddress: backendUser.walletAddress,
          },
          agent: {
            name: data.name,
            handle: data.handle,
            description: data.description,
            imageUrl: data.imageUrl,
            metadata: {
              skills: data.skills,
              repositoryUrl: data.repositoryUrl,
              x: data.x,
              telegram: data.telegram,
            },
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
