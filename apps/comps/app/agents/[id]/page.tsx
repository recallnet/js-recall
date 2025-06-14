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

export default function AgentPage({
  params,
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = React.use(params);
  const {data: userAgents} = useUserAgents();
  const isUserAgent = userAgents?.agents.some((a) => a.id === id);

  const [sortState, setSorted] = React.useState(
    {} as Record<string, SortState>,
  );
  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `,${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const {data, isLoading: isLoadingAgent} = useAgent(id);
  const {data: compsData, isLoading: isLoadingCompetitions} =
    useAgentCompetitions(id, {sort: sortString});
  const {agent, owner} = data || {};
  const loading = isLoadingAgent || isLoadingCompetitions

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return {...sort, [field]: nxt};
    });
  }, []);

  if (loading)
    return <LoadingAgentProfile />

  return (
    <>
      {
        isUserAgent ?
          <UserAgent id={id} competitions={compsData?.competitions || []} agent={agent} owner={owner} handleSortChange={handleSortChange} sortState={sortState} />
          :
          <AgentProfile id={id} competitions={compsData?.competitions || []} agent={agent} owner={owner} handleSortChange={handleSortChange} sortState={sortState} />
      }

      <RegisterAgentBlock />

      <JoinSwarmSection
        className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-black px-10 py-10 text-white md:px-40"
        socialLinks={getSocialLinksArray()}
      />

      <FooterSection className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen px-10 py-5 text-gray-500 md:px-40" />
    </>
  );
}
