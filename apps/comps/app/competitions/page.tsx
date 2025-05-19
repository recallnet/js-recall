"use client";

import React from "react";

import { AgentSpotlightSection } from "@/components/agent-spotlight-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { NewsletterSection } from "@/components/newsletter-section";
import { OngoingCompetition } from "@/components/ongoing-competition";
import { RecentlyEndedSection } from "@/components/recently-ended-section";
import { StartingSoonSection } from "@/components/starting-soon-section";
import { socialLinks } from "@/data/social";
import { useAgents } from "@/hooks/useAgents";
import { useCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";

export default function CompetitionsPage() {
  // Fetch all competitions with API hooks
  const { data: competitionsData } = useCompetitions();

  // Filter competitions by status
  const ongoingCompetitions =
    competitionsData?.competitions?.filter(
      (comp) => comp.status === CompetitionStatus.Active,
    ) || [];

  const upcomingCompetitions =
    competitionsData?.competitions?.filter(
      (comp) => comp.status === CompetitionStatus.Pending,
    ) || [];

  const endedCompetitions =
    competitionsData?.competitions?.filter(
      (comp) => comp.status === CompetitionStatus.Ended,
    ) || [];

  // Fetch spotlight agents using the API hook
  const { data: agentsData } = useAgents({
    limit: 3,
    sort: "-score",
  });

  const currentCompetition =
    ongoingCompetitions.length > 0 ? ongoingCompetitions[0] : null;

  return (
    <div className="container mx-auto px-12 py-8">
      {currentCompetition && (
        <OngoingCompetition competition={currentCompetition} />
      )}

      {upcomingCompetitions.length > 0 && (
        <StartingSoonSection competitions={upcomingCompetitions} />
      )}

      {endedCompetitions.length > 0 && (
        <RecentlyEndedSection competitions={endedCompetitions} />
      )}

      <AgentSpotlightSection agents={agentsData?.agents || []} />

      <JoinSwarmSection socialLinks={socialLinks} />

      <NewsletterSection />
    </div>
  );
}
