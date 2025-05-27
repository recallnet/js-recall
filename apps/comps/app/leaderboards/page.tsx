"use client";

import React from "react";

import {FooterSection} from "@/components/footer-section";
import {LeaderboardSection} from "@/components/leaderboard/index";
import {RegisterAgentBlock} from "@/components/register-agent-block";

import {JoinSwarmSection} from "../../components/join-swarm-section";
import {getSocialLinksArray} from "../../data/social";

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto px-12 py-8">
      <LeaderboardSection />

      <RegisterAgentBlock />

      <JoinSwarmSection className="px-55 py-10 w-screen relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] bg-white text-gray-500" socialLinks={getSocialLinksArray()} />

      <FooterSection />
    </div>
  );
}
