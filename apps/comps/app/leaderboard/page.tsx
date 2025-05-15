"use client";

import React from "react";

import { Leaderboard } from "@/components/leaderboard/index";
import { RegisterAgentBlock } from "@/components/register-agent-block";

import { JoinSwarmSection } from "../../components/join-swarm-section";
import { NewsletterSection } from "../../components/newsletter-section";
import { LeaderboardOngoingCompetition } from "../../components/ongoing-competition/leaderboard";
import { socialLinks } from "../../data/social";
import { useCompetitions } from "../../hooks/useCompetitions";
import { CompetitionStatus } from "../../types";

export default function LeaderboardPage() {
  const { data: competitionsData } = useCompetitions({
    status: CompetitionStatus.Active,
  });

  // Get current active competition if available
  const currentCompetition =
    competitionsData?.competitions && competitionsData.competitions.length > 0
      ? competitionsData.competitions[0]
      : null;

  return (
    <div className="container mx-auto px-12 py-8">
      {currentCompetition && (
        <LeaderboardOngoingCompetition competition={currentCompetition} />
      )}

      <Leaderboard />

      <JoinSwarmSection socialLinks={socialLinks} />

      <RegisterAgentBlock />

      <NewsletterSection />
    </div>
  );
}
