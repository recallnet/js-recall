"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { AgentsTable } from "@/components/agents-table";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CompetitionKey } from "@/components/competition-key";
import CompetitionSkeleton from "@/components/competition-skeleton";
import { FooterSection } from "@/components/footer-section";
import { JoinCompetitionButton } from "@/components/join-competition-button";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import {
  LIMIT_AGENTS_PER_CHART,
  LIMIT_AGENTS_PER_PAGE,
} from "@/components/timeline-chart/constants";
import { TimelineChart } from "@/components/timeline-chart/index";
import { getSocialLinksArray } from "@/data/social";
import { openForBoosting } from "@/lib/open-for-boosting";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

export type CompetitionPageClientProps = {
  params: Promise<{ id: string }>;
};

export default function CompetitionPageClient({
  params,
}: CompetitionPageClientProps) {
  const { id } = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentsTableRef = React.useRef<HTMLDivElement>(null);
  const [agentsSort, setAgentsSort] = React.useState("rank");
  const [agentsOffset, setAgentsOffset] = React.useState(0);

  // Initialize tab from URL or default to "activity"
  const [activeTab, setActiveTab] = React.useState(
    searchParams.get("tab") || "activity",
  );

  // Sync active tab with URL changes (browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "activity";
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "activity") {
      // Remove tab param for default tab to keep URL clean
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : "";
    router.push(`/competitions/${id}${newUrl}`, { scroll: false });
  };

  const {
    data: competition,
    isLoading: isLoadingCompetition,
    error: competitionError,
  } = useQuery(
    tanstackClient.competitions.getById.queryOptions({ input: { id } }),
  );

  // Fetch top 12 agents for chart (independent of table pagination)
  const { data: chartAgentsData, isLoading: isLoadingChartAgents } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      input: {
        competitionId: id,
        paging: {
          sort: "rank",
          offset: 0,
          limit: LIMIT_AGENTS_PER_CHART,
        },
      },
    }),
  );

  // Fetch agents for standings table (paginated)
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

  const handleAgentsPageChange = (page: number) => {
    setAgentsOffset(LIMIT_AGENTS_PER_PAGE * (page - 1));
  };

  const isLoading =
    isLoadingCompetition || isLoadingAgents || isLoadingChartAgents;
  const queryError = competitionError ?? agentsError;

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
        handleTabChange("leaderboard");
      }}
    >
      <span className="font-semibold">BOOST AGENTS</span>{" "}
      <ChevronRight className="ml-2" size={18} />
    </Button>
  );

  return (
    <div>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        {/* Header row with breadcrumb and tabs */}
        <div className="xs:flex-row xs:items-center xs:justify-between xs:gap-0 mb-6 flex flex-col gap-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <BreadcrumbNav
              items={[
                { label: "Home", href: "/" },
                { label: "Competitions", href: "/competitions" },
                { label: competition.name },
              ]}
              className="mb-0 border-b-0 pb-0"
            />
          </div>

          <TabsList className="gap-6 border-none">
            <TabsTrigger
              value="activity"
              className="border-b-2 border-transparent pb-2 uppercase data-[state=active]:border-yellow-500"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="border-b-2 border-transparent pb-2 uppercase data-[state=active]:border-yellow-500"
            >
              Leaderboard
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity">
          {/* Chart and Key grid layout */}
          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <TimelineChart
                competition={competition}
                agents={chartAgentsData?.agents || []}
              />
            </div>
            <div className="md:col-span-1">
              <CompetitionKey competition={competition} />
              {/* Action buttons section */}
              <div className="mt-6 flex w-full gap-3">
                <JoinCompetitionButton
                  competitionId={id}
                  className="flex-1 justify-between border border-white bg-white text-blue-500 hover:border-blue-500 hover:bg-blue-500 hover:text-white disabled:hover:border-white disabled:hover:bg-white disabled:hover:text-blue-500"
                  disabled={competition.status !== "pending"}
                  size="lg"
                >
                  <span>COMPETE</span> <Plus className="ml-2" size={18} />
                </JoinCompetitionButton>

                <BoostAgentsBtn className="flex-1 justify-between uppercase" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          {/* Standings table */}
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
              agents={agentsData.agents}
              onSortChange={setAgentsSort}
              pagination={agentsData.pagination}
              onPageChange={handleAgentsPageChange}
            />
          )}
        </TabsContent>
      </Tabs>

      <JoinSwarmSection socialLinks={getSocialLinksArray()} className="mt-12" />
      <FooterSection />
    </div>
  );
}
