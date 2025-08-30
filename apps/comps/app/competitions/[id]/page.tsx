"use client";

import { useDebounce, useWindowScroll } from "@uidotdev/usehooks";
import { isFuture } from "date-fns";
import { ChevronRight, Plus, Zap } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import Tooltip from "@recallnet/ui2/components/tooltip";
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
import { TimelineChart } from "@/components/timeline-chart/index";
import { TradesTable } from "@/components/trades-table";
import { UserVote } from "@/components/user-vote";
import { getSocialLinksArray } from "@/data/social";
import { useCompetition } from "@/hooks/useCompetition";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { useCompetitionTrades } from "@/hooks/useCompetitionTrades";
import { useUser } from "@/state/atoms";

const LIMIT_AGENTS_PER_PAGE = 10;
const LIMIT_TRADES_PER_PAGE = 10;
const COST_TO_COMPETE = 300;

export default function CompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = useUser();
  const { id } = React.use(params);
  const agentsTableRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [, scrollTo] = useWindowScroll();
  const [agentsFilter, setAgentsFilter] = React.useState("");
  const [agentsSort, setAgentsSort] = React.useState("");
  const [agentsOffset, setAgentsOffset] = React.useState(0);
  const [tradesOffset, setTradesOffset] = React.useState(0);
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
  } = useCompetitionAgents(id, {
    filter: debouncedFilterTerm,
    sort: agentsSort,
    offset: agentsOffset,
    limit: LIMIT_AGENTS_PER_PAGE,
  });
  const {
    data: tradesData,
    isLoading: isLoadingTrades,
    error: tradesError,
  } = useCompetitionTrades(id, {
    offset: tradesOffset,
    limit: LIMIT_TRADES_PER_PAGE,
  });

  const handleAgentsPageChange = (page: number) => {
    setAgentsOffset(LIMIT_AGENTS_PER_PAGE * (page - 1));
  };

  const handleTradesPageChange = (page: number) => {
    setTradesOffset(LIMIT_TRADES_PER_PAGE * (page - 1));
  };

  const isLoading = isLoadingCompetition || isLoadingAgents || isLoadingTrades;
  const queryError = competitionError ?? agentsError ?? tradesError;

  React.useEffect(() => {
    handleAgentsPageChange(1);
  }, [debouncedFilterTerm, agentsSort]);

  if (isLoading) {
    return <CompetitionSkeleton />;
  }

  if (queryError || !competition) {
    return (
      <div className="container mx-auto px-12 py-20 text-center">
        <h2 className="text-2xl font-bold text-red-500">Error</h2>
        <p className="mt-4">
          {queryError instanceof Error
            ? queryError.message
            : "Competition not found"}
        </p>
        <Link href="/competitions" className="mt-8 inline-block underline">
          Back to competitions
        </Link>
      </div>
    );
  }

  const VotingBtn = ({
    className,
    disabled,
  }: {
    className: string;
    disabled?: boolean;
  }) => (
    <Button
      disabled={!competition.votingEnabled || disabled}
      variant="default"
      className={cn(
        "border border-blue-500 bg-blue-500 text-white hover:bg-white hover:text-blue-500 disabled:hover:bg-blue-500 disabled:hover:text-white",
        className,
      )}
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
      <span className="font-semibold">VOTE</span>{" "}
      <ChevronRight className="ml-2" size={18} />
    </Button>
  );

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
      <div className="mb-10 flex w-full flex-col gap-3 sm:mb-20 sm:gap-5 md:flex-row">
        <BasicCompetitionCard competition={competition} className="md:w-1/2" />
        <div className="md:w-1/2">
          <CompetitionInfo competition={competition} />
          <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
            <JoinCompetitionButton
              competitionId={id}
              variant="outline"
              className="w-full justify-between border border-gray-700 sm:w-1/2"
              disabled={competition.status !== "pending"}
              size="lg"
            >
              <span>
                COMPETE{" "}
                <span className="text-yellow-500">{COST_TO_COMPETE}</span>{" "}
                <span className="font-bold">Boost</span>{" "}
                <Zap className="inline h-4 w-4 text-yellow-500" />
              </span>{" "}
            </JoinCompetitionButton>

            <VotingBtn className="w-full justify-between uppercase sm:w-1/2" />

            {/*<Button
              variant="outline"
              className={cn(
                "w-full justify-between border border-gray-700 uppercase sm:w-1/2",
              )}
              size="lg"
              onClick={() => {
                if (chartRef.current) {
                  scrollTo({
                    top: chartRef.current.offsetTop,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <div className={cn("flex w-full items-center justify-between")}>
                <span className="font-semibold">Chart</span>{" "}
                <ChevronRight className="ml-2" size={18} />
              </div>
            </Button>*/}
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
              showDuration={true}
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
        <>
          <TimelineChart
            ref={chartRef}
            className="mt-5"
            competition={competition}
            agents={agentsData?.agents || []}
            totalAgents={agentsData?.pagination?.total || 0}
            currentPage={
              Math.floor(
                (agentsData?.pagination?.offset || 0) /
                  (agentsData?.pagination?.limit || LIMIT_AGENTS_PER_PAGE),
              ) + 1
            }
            onPageChange={handleAgentsPageChange}
          />
          <AgentsTable
            ref={agentsTableRef}
            competition={competition}
            agents={agentsData.agents}
            onFilterChange={setAgentsFilter}
            onSortChange={setAgentsSort}
            pagination={agentsData.pagination}
            totalVotes={competition.stats.totalVotes}
            onPageChange={handleAgentsPageChange}
          />
        </>
      )}

      <TradesTable
        trades={tradesData?.trades || []}
        pagination={
          tradesData?.pagination || {
            total: 0,
            limit: LIMIT_TRADES_PER_PAGE,
            offset: tradesOffset,
            hasMore: false,
          }
        }
        onPageChange={handleTradesPageChange}
        showSignInMessage={user.status !== "authenticated"}
      />

      <JoinSwarmSection socialLinks={getSocialLinksArray()} className="mt-12" />
      <FooterSection />
    </div>
  );
}
