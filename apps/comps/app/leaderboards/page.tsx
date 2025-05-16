import React from "react";

import { JoinSwarmSection } from "@/components/join-swarm-section";
import { Leaderboard } from "@/components/leaderboard";
import { NewsletterSection } from "@/components/newsletter-section";
import { LeaderboardOngoingCompetition } from "@/components/ongoing-competition/leaderboard";
import { RegisterAgentBlock } from "@/components/register-agent-block";
import { ongoingCompetitions } from "@/data/competitions";
import { socialLinks } from "@/data/social";

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
