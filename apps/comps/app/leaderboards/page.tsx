"use client";

import React from "react";

import { FooterSection } from "@/components/footer-section";
import { LeaderboardSection } from "@/components/leaderboard/index";
import { RegisterAgentBlock } from "@/components/register-agent-block";

import { JoinSwarmSection } from "../../components/join-swarm-section";
import { socialLinks } from "../../data/social";

export default function LeaderboardPage() {
  return (
    <div className="container max-w-[1600px] py-8 md:px-12">
      <LeaderboardSection />

      <RegisterAgentBlock />

      <JoinSwarmSection socialLinks={socialLinks} />

      <FooterSection />
    </div>
  );
}
