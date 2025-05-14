"use client";

import {ArrowLeftIcon} from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import {IconButton} from "@recallnet/ui2/components/icon-button";

import {AgentsTable} from "@/components/agents-table";
import {CompetitionInfo} from "@/components/competition-info";
import {JoinSwarmSection} from "@/components/join-swarm-section";
import {NewsletterSection} from "@/components/newsletter-section";
import {UpComingCompetition} from "@/components/upcoming-competition";
import {socialLinks} from "@/data/social";
import {useCompetition} from "@/hooks/useCompetition";
import {useCompetitionAgents} from "@/hooks/useCompetitionAgents";

export default function CompetitionPage({
  params,
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = React.use(params);
  const {
    data: competition,
    isLoading: isLoadingCompetition,
    error: competitionError,
  } = useCompetition(id);
  const {
    data: agentsData,
    isLoading: isLoadingAgents,
    error: agentsError,
    isFetching: isFetchingAgents,
  } = useCompetitionAgents(id, {
    filter: debouncedFilterTerm,
    sort: agentsSort,
    limit: agentsLimit,
    offset: agentsOffset,
  });

  React.useEffect(() => {
    setAgentsOffset(0);
  }, [debouncedFilterTerm, agentsSort]);

  React.useEffect(() => {
    if (!agentsData?.agents || isFetchingAgents) return;

    if (agentsOffset === 0) {
      setAllAgents(agentsData.agents);
    } else {
      setAllAgents((prev) => [...prev, ...agentsData.agents]);
    }
  }, [agentsData?.agents, isFetchingAgents, agentsOffset]);

  const isLoading = isLoadingCompetition || isLoadingAgents;
  const error = competitionError;

  if (isLoading) {
    return (
      <div className="container mx-auto px-12 py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4">Loading competition data...</p>
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="container mx-auto px-12 py-20 text-center">
        <h2 className="text-2xl font-bold text-red-500">Error</h2>
        <p className="mt-4">{error?.message || "Competition not found"}</p>
        <Link href="/competitions" className="mt-8 inline-block underline">
          Back to competitions
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 py-8">
        <Link href="/competitions">
          <IconButton Icon={ArrowLeftIcon} aria-label="Back" />
        </Link>
        <h1 className="font-bold">Competition Page</h1>
      </div>
      <UpComingCompetition competition={competition} />
      <CompetitionInfo competition={competition} />

      {agentsError ? (
        <div className="my-12 rounded border border-red-400 bg-red-100 bg-opacity-10 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400">
            Failed to load agents
          </h2>
          <p className="mt-2 text-slate-300">
            {agentsError.message ||
              "An error occurred while loading agents data"}
          </p>
        </div>
      ) : (
        <AgentsTable
          agents={allAgents}
          onFilterChange={setAgentsFilter}
          onSortChange={setAgentsSort}
          onLoadMore={() => {
            setAgentsOffset((prev) => prev + agentsLimit);
          }}
          hasMore={(agentsData?.metadata?.total ?? 0) > allAgents.length}
          metadata={agentsData?.metadata}
        />
      )}
      <JoinSwarmSection socialLinks={socialLinks} />
      <NewsletterSection />
    </>
  );
}
