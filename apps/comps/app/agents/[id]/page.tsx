"use client";

import React from "react";

import AgentProfile from "@/components/agent-profile";
import { LoadingAgentProfile } from "@/components/agent-profile/loading";
import { FooterSection } from "@/components/footer-section";
import { useAgent } from "@/hooks/useAgent";
import { useSorting } from "@/hooks/useSorting";
import { AgentWithOwnerResponse } from "@/types";

export default function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const [status, setCompStatus] = React.useState("all");
  const { sortState, handleSortChange } = useSorting();
  const { data, isLoading: isLoadingAgent } = useAgent(id);
  const { agent, owner } = data || ({} as unknown as AgentWithOwnerResponse);

  if (isLoadingAgent || !agent) return <LoadingAgentProfile />;

  return (
    <>
      <AgentProfile
        id={id}
        agent={agent}
        owner={owner}
        handleSortChange={handleSortChange}
        sortState={sortState}
        status={status}
        setStatus={setCompStatus}
      />

      <FooterSection />
    </>
  );
}
