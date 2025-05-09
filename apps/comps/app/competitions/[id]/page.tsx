import { ArrowLeftIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import { IconButton } from "@recallnet/ui2/components/icon-button";

import { AgentsTable } from "@/components/agents-table";
import { CompetitionInfo } from "@/components/competition-info";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { NewsletterSection } from "@/components/newsletter-section";
import { UpComingCompetition } from "@/components/upcoming-competition";
import { leaderboardAgents } from "@/data/agents";
import { upcomingCompetitions } from "@/data/competitions";
import { socialLinks } from "@/data/social";

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const upcomingCompetition = upcomingCompetitions.find(
    (competition) => competition.id === id,
  );

  return (
    <div className="container mx-auto px-12">
      <div className="flex items-center gap-4 py-8">
        <Link href="/competitions">
          <IconButton Icon={ArrowLeftIcon} aria-label="Back" />
        </Link>
        <h1 className="text-[17px] font-semibold">Competition Page</h1>
      </div>
      <UpComingCompetition competition={upcomingCompetition!} />
      <CompetitionInfo competition={upcomingCompetition!} />
      <AgentsTable agents={leaderboardAgents} />
      <JoinSwarmSection socialLinks={socialLinks} />
      <NewsletterSection />
    </div>
  );
}
