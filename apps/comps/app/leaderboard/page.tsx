import React from "react";

import { Leaderboard } from "@/components/leaderboard/index";

import { JoinSwarmSection } from "../../components/join-swarm-section";
import { NewsletterSection } from "../../components/newsletter-section";
import { OngoingCompetition } from "../../components/ongoing-competition/leaderboard";
import { ongoingCompetitions } from "../../data/competitions";
import { socialLinks } from "../../data/social";

export default function CompetitionsPage() {
  const currentCompetition =
    ongoingCompetitions.length > 0 ? ongoingCompetitions[0] : null;

  return (
    <div className="container mx-auto px-12 py-8">
      {currentCompetition && (
        <OngoingCompetition competition={currentCompetition} />
      )}

      <Leaderboard />

      <JoinSwarmSection socialLinks={socialLinks} />

      <NewsletterSection />
    </div>
  );
}
