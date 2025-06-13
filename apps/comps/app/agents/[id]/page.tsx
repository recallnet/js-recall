"use client";

import React from "react";

import AgentProfile from "@/components/agent-profile";
import UserAgent from "@/components/agent-profile/user-agent";
import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { RegisterAgentBlock } from "@/components/register-agent-block";
import { getSocialLinksArray } from "@/data/social";
import { useUserAgents } from "@/hooks/useAgents";

export default function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const { data: userAgents } = useUserAgents();
  const isUserAgent = userAgents?.agents.some((a) => a.id === id);

  return (
    <>
      {isUserAgent ? <UserAgent id={id} /> : <AgentProfile id={id} />}

      <RegisterAgentBlock />

      <JoinSwarmSection
        className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-black px-10 py-10 text-white md:px-40"
        socialLinks={getSocialLinksArray()}
      />

      <FooterSection className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen px-10 py-5 text-gray-500 md:px-40" />
    </>
  );
}
