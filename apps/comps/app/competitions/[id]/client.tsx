"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebounce, useWindowScroll } from "@uidotdev/usehooks";
import { isFuture } from "date-fns";
import { ChevronRight, Plus } from "lucide-react";
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
import { FooterSection } from "@/components/footer-section";
import { JoinCompetitionButton } from "@/components/join-competition-button";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { PositionsTable } from "@/components/positions-table";
import { TimelineChart } from "@/components/timeline-chart/index";
import { TradesTable } from "@/components/trades-table";
import { getSocialLinksArray } from "@/data/social";
import { useCompetitionPerpsPositions } from "@/hooks/useCompetitionPerpsPositions";
import { useCompetitionTrades } from "@/hooks/useCompetitionTrades";
import { useSession } from "@/hooks/useSession";
import { openForBoosting } from "@/lib/open-for-boosting";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

const LIMIT_AGENTS_PER_PAGE = 10;
const LIMIT_TRADES_PER_PAGE = 10;
const LIMIT_POSITIONS_PER_PAGE = 10;

export type CompetitionPageClientProps = {
  params: Promise<{ id: string }>;
};

export default function CompetitionPageClient({
  params,
}: CompetitionPageClientProps) {
  const { isAuthenticated } = useSession();
  const { id } = React.use(params);
  const agentsTableRef = React.useRef<HTMLDivElement>(null);
  const [, scrollTo] = useWindowScroll();
  const [agentsFilter, setAgentsFilter] = React.useState("");
  const [agentsSort, setAgentsSort] = React.useState("rank");
  const [agentsOffset, setAgentsOffset] = React.useState(0);
  const [tradesOffset, setTradesOffset] = React.useState(0);
  const [positionsOffset, setPositionsOffset] = React.useState(0);
  const debouncedFilterTerm = useDebounce(agentsFilter, 300);

  const {
    data: competition,
    isLoading: isLoadingCompetition,
    error: competitionError,
  } = useQuery(
    tanstackClient.competitions.getById.queryOptions({ input: { id } }),
  );

  const {
    data: agentsData,
    isLoading: isLoadingAgents,
    error: agentsError,
  } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      placeholderData: keepPreviousData,
      input: {
        competitionId: id,
        paging: {
          sort: agentsSort,
          offset: agentsOffset,
          limit: LIMIT_AGENTS_PER_PAGE,
        },
      },
    }),
  );

  // Determine if we're in a perps competition
  const isPerpsCompetition = competition?.type === "perpetual_futures";

  // Use appropriate hook based on competition type
  // Note: both hooks will be called, but only one will actually fetch data based on enabled condition
  const {
    data: tradesData,
    isLoading: isLoadingTrades,
    error: tradesError,
  } = useCompetitionTrades(
    id,
    {
      offset: tradesOffset,
      limit: LIMIT_TRADES_PER_PAGE,
    },
    !isPerpsCompetition, // enabled only for non-perps competitions
  );

  const {
    data: positionsData,
    isLoading: isLoadingPositions,
    error: positionsError,
  } = useCompetitionPerpsPositions(
    id,
    {
      offset: positionsOffset,
      limit: LIMIT_POSITIONS_PER_PAGE,
    },
    isPerpsCompetition, // enabled only for perps competitions
  );

  const handleAgentsPageChange = (page: number) => {
    setAgentsOffset(LIMIT_AGENTS_PER_PAGE * (page - 1));
  };

  const handleTradesPageChange = (page: number) => {
    setTradesOffset(LIMIT_TRADES_PER_PAGE * (page - 1));
  };

  const handlePositionsPageChange = (page: number) => {
    setPositionsOffset(LIMIT_POSITIONS_PER_PAGE * (page - 1));
  };

  const isLoading =
    isLoadingCompetition ||
    isLoadingAgents ||
    (!isPerpsCompetition && isLoadingTrades) ||
    (isPerpsCompetition && isLoadingPositions);
  const queryError =
    competitionError ??
    agentsError ??
    (!isPerpsCompetition && tradesError) ??
    (isPerpsCompetition && positionsError);

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

  const BoostAgentsBtn = ({
    className,
    disabled,
  }: {
    className: string;
    disabled?: boolean;
  }) => (
    <Button
      disabled={!openForBoosting(competition) || disabled}
      variant="default"
      className={cn(
        "border border-yellow-500 bg-black text-white hover:bg-yellow-500 hover:text-black disabled:hover:bg-black disabled:hover:text-white",
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
      <span className="font-semibold">BOOST AGENTS</span>{" "}
      <ChevronRight className="ml-2" size={18} />
    </Button>
  );

  return (
    <div>
      <BreadcrumbNav
        items={[
          { label: "Recall", href: "/" },
          { label: "Competitions", href: "/competitions" },
          { label: competition.name },
        ]}
        className="mb-10"
      />
      <div className="mb-10 flex w-full flex-col gap-3 sm:mb-20 sm:gap-5 md:flex-row">
        <BasicCompetitionCard competition={competition} className="md:w-1/2" />
        <div className="md:w-1/2">
          <CompetitionInfo competition={competition} />
          <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
            <JoinCompetitionButton
              competitionId={id}
              className="w-full justify-between border border-white bg-white text-blue-500 hover:border-blue-500 hover:bg-blue-500 hover:text-white disabled:hover:border-white disabled:hover:bg-white disabled:hover:text-blue-500 sm:w-1/2"
              disabled={competition.status !== "pending"}
              size="lg"
            >
              <span>COMPETE</span> <Plus className="ml-2" size={18} />
            </JoinCompetitionButton>

            <BoostAgentsBtn className="w-full justify-between uppercase sm:w-1/2" />
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
        competition.votingStartDate &&
        isFuture(new Date(competition.votingStartDate)) && (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center sm:flex-row">
            <span className="text-2xl font-bold text-gray-400">
              Boosting begins in...
            </span>
            <CountdownClock
              showDuration={true}
              targetDate={new Date(competition.votingStartDate)}
            />
          </div>
        )}

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
          <AgentsTable
            ref={agentsTableRef}
            competition={competition}
            agents={agentsData.agents}
            onFilterChange={setAgentsFilter}
            onSortChange={setAgentsSort}
            pagination={agentsData.pagination}
            onPageChange={handleAgentsPageChange}
          />
          <TimelineChart
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
        </>
      )}

      {isPerpsCompetition ? (
        <PositionsTable
          positions={positionsData?.positions || []}
          pagination={
            positionsData?.pagination || {
              total: 0,
              limit: LIMIT_POSITIONS_PER_PAGE,
              offset: positionsOffset,
              hasMore: false,
            }
          }
          onPageChange={handlePositionsPageChange}
          showSignInMessage={!isAuthenticated}
        />
      ) : (
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
          showSignInMessage={!isAuthenticated}
        />
      )}

      <JoinSwarmSection socialLinks={getSocialLinksArray()} className="mt-12" />
      <FooterSection />
    </div>
  );
}
