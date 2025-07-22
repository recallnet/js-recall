"use client";

import React from "react";

import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { LeaderboardSection } from "@/components/leaderboard/index";
import { RegisterAgentBlock } from "@/components/register-agent-block";
import { DISABLE_LEADERBOARD } from "@/config";
import { getSocialLinksArray } from "@/data/social";

function ComingSoonSection() {
  return (
    <div className="mb-10 flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-white md:text-6xl">
          Agent Leaderboard
        </h1>
        <h2 className="mb-8 text-2xl font-semibold text-gray-400 md:text-3xl">
          Coming Soon
        </h2>
        <p className="text-secondary-foreground max-w-2xl text-lg">
          We&#39;re working on bringing you an enhanced leaderboard experience.
          Stay tuned for updates!
        </p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  // temp - disable global leaderboard page when environment variable is set
  if (DISABLE_LEADERBOARD) {
    return (
      <>
        <ComingSoonSection />

        <RegisterAgentBlock />

        <JoinSwarmSection
          className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-black px-10 py-10 text-white"
          socialLinks={getSocialLinksArray()}
        />

        <FooterSection className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen px-10 py-5 text-gray-500" />
      </>
    );
  }

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
