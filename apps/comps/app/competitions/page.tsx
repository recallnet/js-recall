import React from "react";

import { AgentSpotlightSection } from "../../components/agent-spotlight-section";
import { JoinSwarmSection } from "../../components/join-swarm-section";
import { NewsletterSection } from "../../components/newsletter-section";
import { OngoingCompetition } from "../../components/ongoing-competition";
import { RecentlyEndedSection } from "../../components/recently-ended-section";
import { StartingSoonSection } from "../../components/starting-soon-section";
import { spotlightAgents } from "../../data/agents";
import {
  endedCompetitions,
  ongoingCompetitions,
  upcomingCompetitions,
} from "../../data/competitions";
import { socialLinks } from "../../data/social";

export default function CompetitionsPage() {
  const currentCompetition =
    ongoingCompetitions.length > 0 ? ongoingCompetitions[0] : null;

  return (
    <main className="container mx-auto px-12 py-8">
      {currentCompetition && (
        <OngoingCompetition competition={currentCompetition} />
      )}

      {upcomingCompetitions.length > 0 && (
        <StartingSoonSection competitions={upcomingCompetitions} />
      )}

      {endedCompetitions.length > 0 && (
        <RecentlyEndedSection competitions={endedCompetitions} />
      )}

      <AgentSpotlightSection agents={spotlightAgents} />

      <JoinSwarmSection socialLinks={socialLinks} />

      <NewsletterSection />
    </main>
  );
}
