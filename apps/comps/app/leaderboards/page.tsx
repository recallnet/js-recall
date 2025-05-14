"use client";

import React from "react";

import {LeaderboardSection} from "@/components/leaderboard/index";
import {RegisterAgentBlock} from "@/components/register-agent-block";

import {JoinSwarmSection} from "../../components/join-swarm-section";
import {NewsletterSection} from "../../components/newsletter-section";
import {socialLinks} from "../../data/social";

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto px-12 py-8">
      <LeaderboardSection />

      <JoinSwarmSection socialLinks={socialLinks} />

      <RegisterAgentBlock />

      <JoinSwarmSection socialLinks={socialLinks} />

      <FooterSection />
    </>
  );
}
