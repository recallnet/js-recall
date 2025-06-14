"use client";

import React from "react";

import AgentProfile from "@/components/agent-profile";
import {FooterSection} from "@/components/footer-section";
import {JoinSwarmSection} from "@/components/join-swarm-section";
import {RegisterAgentBlock} from "@/components/register-agent-block";
import {getSocialLinksArray} from "@/data/social";
import {useAgent} from "@/hooks/useAgent";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";
import {LoadingAgentProfile} from "@/components/agent-profile/loading";
import {SortState} from "@recallnet/ui2/components/table"
import {useUserAgents} from "@/hooks";
import UserAgent from "@/components/agent-profile/user-agent";
import {AgentWithOwnerResponse} from "@/types";

export default function AgentPage({
  params,
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = React.use(params);

  const [status, setCompStatus] = React.useState("all");
  const [sortState, setSorted] = React.useState(
    {} as Record<string, SortState>,
  );
  const {data, isLoading: isLoadingAgent} = useAgent(id);
  const {agent, owner} = data || {} as unknown as AgentWithOwnerResponse;

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return {[field]: nxt};
    });
  }, []);

  if (isLoadingAgent)
    return <LoadingAgentProfile />

  return (
    <>
      <AgentProfile id={id} agent={agent} owner={owner} handleSortChange={handleSortChange} sortState={sortState} status={status} setStatus={setCompStatus} />

      <RegisterAgentBlock />

      <JoinSwarmSection
        socialLinks={getSocialLinksArray()}
      />

      <FooterSection />
    </>
  );
}
