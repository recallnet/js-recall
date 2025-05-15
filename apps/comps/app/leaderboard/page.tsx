"use client";

import React from "react";

import {LeaderboardSection} from "@/components/leaderboard/index";
import {RegisterAgentBlock} from "@/components/register-agent-block";

import {JoinSwarmSection} from "../../components/join-swarm-section";
import {socialLinks} from "../../data/social";
import {FooterSection} from "@/components/footer-section";

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto px-12 py-8">
      <LeaderboardSection />

      <RegisterAgentBlock />

      <JoinSwarmSection socialLinks={socialLinks} />

      <FooterSection />

    </div>
  );
}
