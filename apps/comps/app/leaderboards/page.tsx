"use client";

import React from "react";

import { FooterSection } from "@/components/footer-section";
import { LeaderboardSection } from "@/components/leaderboard/index";
import { RegisterAgentBlock } from "@/components/register-agent-block";

import { JoinSwarmSection } from "../../components/join-swarm-section";
import { getSocialLinksArray } from "../../data/social";

export default function LeaderboardPage() {
  return (
    <>
      <LeaderboardSection />

      <RegisterAgentBlock />

      <JoinSwarmSection
        className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-black px-10 py-10 text-white"
        socialLinks={getSocialLinksArray()}
      />

      <FooterSection className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen px-10 py-5 text-gray-500" />
    </>
  );
}
