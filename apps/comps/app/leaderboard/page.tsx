import React from "react";

import { Leaderboard } from "@/components/leaderboard/index";
import { RegisterAgentBlock } from "@/components/register-agent-block";

import { JoinSwarmSection } from "../../components/join-swarm-section";
import { NewsletterSection } from "../../components/newsletter-section";
import { LeaderboardOngoingCompetition } from "../../components/ongoing-competition/leaderboard";
import { ongoingCompetitions } from "../../data/competitions";
import { socialLinks } from "../../data/social";

export default function LeaderboardPage() {
  const currentCompetition =
    ongoingCompetitions.length > 0 ? ongoingCompetitions[0] : null;

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
