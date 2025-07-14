"use client";

import { useDebounce, useWindowScroll } from "@uidotdev/usehooks";
import { isFuture } from "date-fns";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentsTable } from "@/components/agents-table";
import { BasicCompetitionCard } from "@/components/basic-competition-card";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CountdownClock } from "@/components/clock";
import { CompetitionInfo } from "@/components/competition-info";
import CompetitionSkeleton from "@/components/competition-skeleton";
import { CompetitionVotingBanner } from "@/components/competition-voting-banner";
import { FooterSection } from "@/components/footer-section";
import { JoinCompetitionButton } from "@/components/join-competition-button";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { UserVote } from "@/components/user-vote";
import { getSocialLinksArray } from "@/data/social";
import { useCompetition } from "@/hooks/useCompetition";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { AgentCompetition } from "@/types";

export default function CompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const agentsTableRef = React.useRef<HTMLDivElement>(null);
  const [, scrollTo] = useWindowScroll();
  const [agentsFilter, setAgentsFilter] = React.useState("");
  const [agentsSort, setAgentsSort] = React.useState("");
  const [agentsLimit] = React.useState(10);
  const [agentsOffset, setAgentsOffset] = React.useState(0);
  const [allAgents, setAllAgents] = React.useState<AgentCompetition[]>([]);
  const debouncedFilterTerm = useDebounce(agentsFilter, 300);

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
    return <CompetitionSkeleton />;
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
    <div style={{ marginTop: "-40px" }}>
      <CompetitionVotingBanner competition={competition} />
      <BreadcrumbNav
        items={[
          { label: "Recall", href: "/" },
          { label: "Competitions", href: "/competitions" },
          { label: competition.name },
        ]}
        className="mb-10 mt-10"
      />
      <div className="mb-20 flex w-full flex-col gap-5 md:flex-row">
        <BasicCompetitionCard competition={competition} className="md:w-1/2" />
        <div className="md:w-1/2">
          <CompetitionInfo competition={competition} />
          <div className="mt-5 flex w-full flex-row justify-center gap-4">
            <a
              href="https://discord.com/invite/recallnet"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex w-1/2 items-center justify-between",
                "text-secondary-foreground border border-gray-400 text-sm",
                "transition duration-500 ease-in-out hover:bg-blue-700 hover:text-white",
              )}
            >
              <span className="font-semibold">Join Discord</span>{" "}
              <ArrowUpRight className="ml-2" size={18} />
            </a>
            <JoinCompetitionButton
              competitionId={id}
              variant="ghost"
              className="w-1/2 justify-between uppercase"
              disabled={competition.status !== "pending"}
              size="lg"
            >
              <span className="font-semibold">Join Competition</span>{" "}
              <ChevronRight className="ml-2" size={18} />
            </JoinCompetitionButton>
            {competition.userVotingInfo?.canVote ? (
              <Button
                disabled={!competition.votingEnabled}
                variant="ghost"
                className="w-1/2 justify-between uppercase"
                size="lg"
                onClick={() => {
                  if (agentsTableRef.current) {
                    scrollTo({
                      top: agentsTableRef.current.offsetTop,
                      behavior: "smooth",
                    });
                  }
                }}
              >
                <span className="font-semibold">Vote on an Agent</span>{" "}
                <ChevronRight className="ml-2" size={18} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {competition.status === "pending" && competition.startDate && (
        <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center sm:flex-row">
          <span className="text-2xl font-bold text-gray-400">
            Competition starts in...
          </span>
          <CountdownClock
            showDuration={true}
            targetDate={new Date(competition.startDate)}
          />
        </div>
      )}

      {competition.status !== "ended" &&
        !competition.votingEnabled &&
        competition.votingStartDate &&
        isFuture(new Date(competition.votingStartDate)) && (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center sm:flex-row">
            <span className="text-2xl font-bold text-gray-400">
              Voting begins in...
            </span>
            <CountdownClock
              targetDate={new Date(competition.votingStartDate)}
            />
          </div>
        )}

      {competition.userVotingInfo?.info.agentId ? (
        <UserVote
          agentId={competition.userVotingInfo.info.agentId}
          competitionId={id}
          totalVotes={competition.stats.totalVotes}
        />
      ) : null}

      {agentsError || !agentsData ? (
        <div className="my-12 rounded border border-red-500 bg-opacity-10 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-500">
            Failed to load agents
          </h2>
          <p className="mt-2">
            {agentsError?.message ||
              "An error occurred while loading agents data"}
          </p>
        </div>
      ) : (
        <AgentsTable
          ref={agentsTableRef}
          competition={competition}
          agents={allAgents}
          onFilterChange={setAgentsFilter}
          onSortChange={setAgentsSort}
          onLoadMore={() => {
            setAgentsOffset((prev) => prev + agentsLimit);
          }}
          hasMore={agentsData.pagination.hasMore}
          pagination={agentsData.pagination}
          totalVotes={competition.stats.totalVotes}
        />
      )}
      <JoinSwarmSection socialLinks={getSocialLinksArray()} className="mt-12" />
      <FooterSection />
    </div>
  );
}
