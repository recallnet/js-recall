"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { ChartNoAxesColumn, Loader2, Trophy, Users } from "lucide-react";
import React, { useCallback, useState } from "react";

import { getExpectedTypeForSkill } from "@recallnet/services/lib";
import { Badge } from "@recallnet/ui2/components/badge";
import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CompetitionCard } from "@/components/competition-card";
import { useSession } from "@/hooks/useSession";
import { client } from "@/rpc/clients/client-side";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
import { LeaderboardAgent } from "@/types/agent";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { ArenaDetailLeaderboardTable } from "./arena-detail-leaderboard-table";
import { ArenaDetailLeaderboardTableMobile } from "./arena-detail-leaderboard-table-mobile";

interface ArenaDetailPageProps {
  arenaId: string;
}

export const ArenaDetailPage: React.FC<ArenaDetailPageProps> = ({
  arenaId,
}) => {
  const [additionalAgents, setAdditionalAgents] = useState<LeaderboardAgent[]>(
    [],
  );
  const [currentOffset, setCurrentOffset] = useState(100); // Start at 100 since initial load gets first 100
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const session = useSession();
  const { isAuthenticated } = session;

  // Fetch arena data
  const {
    data: arena,
    isLoading: arenaLoading,
    error: arenaError,
  } = useQuery(
    tanstackClient.arena.getById.queryOptions({
      input: { id: arenaId },
    }),
  );

  // Fetch all competitions for this arena
  const { data: arenaCompetitionsData } = useQuery(
    tanstackClient.arena.getCompetitions.queryOptions({
      input: {
        arenaId,
        paging: { limit: 100, offset: 0, sort: "-startDate" },
      },
    }),
  );

  const { data: userCompetitions } = useQuery(
    tanstackClient.user.getCompetitions.queryOptions({
      input: isAuthenticated ? {} : skipToken,
      placeholderData: (prev) => prev,
    }),
  );

  // Derive competition type from arena skill using shared validation registry
  const competitionType =
    getExpectedTypeForSkill(arena?.skill ?? "") ?? "trading";

  // Fetch leaderboard data
  const {
    data: leaderboardData,
    isLoading: leaderboardLoading,
    error: leaderboardError,
  } = useQuery({
    queryKey: ["arena-leaderboard", arenaId],
    queryFn: async () => {
      const result = await client.leaderboard.getGlobal({
        type: competitionType,
        limit: 100,
        offset: 0,
        arenaId,
      });
      return result;
    },
    enabled: !!arena,
  });

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const result = await client.leaderboard.getGlobal({
        type: competitionType,
        limit: 100,
        offset: currentOffset,
        arenaId,
      });
      if (result?.agents) {
        setAdditionalAgents((prev) => [...prev, ...result.agents]);
        setCurrentOffset((prev) => prev + 100);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset, arenaId, competitionType]);

  const isLoading = arenaLoading || leaderboardLoading;
  const error = arenaError || leaderboardError;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="text-gray-400">Loading arena data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-16">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: "Arenas", href: "/arenas" },
          ]}
        />
        <Card className="p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-400">
            Error Loading Arena
          </h3>
          <p className="text-gray-400">
            Unable to load arena data. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  if (!arena || !leaderboardData) {
    return (
      <div className="space-y-8 pb-16">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: "Arenas", href: "/arenas" },
          ]}
        />
        <Card className="p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-yellow-400">
            Arena Not Found
          </h3>
          <p className="text-gray-400">
            The requested arena could not be found or is not currently
            available.
          </p>
        </Card>
      </div>
    );
  }

  // Combine agents
  const allAgents = [...leaderboardData.agents, ...additionalAgents];

  // Separate by status and merge with user data
  // Type assertion: Both arena.getCompetitions and competitions.list use buildFullCompetitionQuery()
  // and apply identical transformations, so runtime shapes are guaranteed to match
  const allArenaCompetitions = (arenaCompetitionsData?.competitions ||
    []) as RouterOutputs["competitions"]["list"]["competitions"];
  const [activeComps, upcomingComps, endedComps] = [
    mergeCompetitionsWithUserData(
      allArenaCompetitions.filter((c) => c.status === "active"),
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
    mergeCompetitionsWithUserData(
      allArenaCompetitions.filter((c) => c.status === "pending"),
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
    mergeCompetitionsWithUserData(
      allArenaCompetitions.filter((c) => c.status === "ended"),
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
  ];

  return (
    <div className="space-y-8 pb-16">
      <BreadcrumbNav
        items={[
          { label: "Home", href: "/" },
          { label: "Arenas", href: "/arenas" },
          { label: arena.name },
        ]}
      />

      {/* Arena Info */}
      <div className="space-y-6">
        <div>
          <h1 className="mb-4 text-4xl font-bold text-white">{arena.name}</h1>
        </div>

        {/* Arena Metadata */}
        <Card className="border-gray-800 bg-gray-900/30 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center justify-between gap-2 md:justify-start">
              <span className="text-sm text-gray-400">Skill:</span>
              <Badge className={cn("text-sm", "bg-green-900 text-green-300")}>
                {arena.skill.toUpperCase().replace(/_/g, " ")}
              </Badge>
            </div>
            {arena.venues && arena.venues.length > 0 && (
              <div className="flex items-center justify-between gap-2 md:justify-start">
                <span className="text-sm text-gray-400">Venues:</span>
                {arena.venues.map((venue) => (
                  <Badge
                    key={venue}
                    className={cn("text-sm", "bg-blue-900 text-blue-300")}
                  >
                    {venue.toUpperCase()}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Stats Overview - Compact on Mobile */}
        <div className="md:hidden">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="mb-1 flex items-center justify-center gap-1">
                  <Users size={16} className="text-gray-400" />
                  <span className="text-lg font-bold text-white">
                    {leaderboardData.pagination.total}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Agents</div>
              </div>

              {leaderboardData.agents.length > 0 &&
                leaderboardData.agents[0]?.score && (
                  <div>
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <Trophy size={16} className="text-green-400" />
                      <span className="text-lg font-bold text-green-400">
                        {leaderboardData.agents[0].score.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">Top Score</div>
                  </div>
                )}

              {leaderboardData.agents.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <ChartNoAxesColumn size={16} className="text-blue-400" />
                    <span className="text-lg font-bold text-blue-400">
                      {(
                        leaderboardData.agents.reduce(
                          (sum, agent) => sum + agent.score,
                          0,
                        ) / leaderboardData.agents.length
                      ).toFixed(0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">Average</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Stats Overview - Desktop */}
        <div className="hidden grid-cols-3 gap-6 md:grid">
          <Card className="p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Users size={20} className="text-gray-400" />
              <span className="text-2xl font-bold text-white">
                {leaderboardData.pagination.total}
              </span>
            </div>
            <div className="text-sm text-gray-400">Total Agents</div>
          </Card>

          {leaderboardData.agents.length > 0 &&
            leaderboardData.agents[0]?.score && (
              <Card className="p-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Trophy size={20} className="text-green-400" />
                  <span className="text-2xl font-bold text-green-400">
                    {leaderboardData.agents[0].score.toFixed(0)}
                  </span>
                </div>
                <div className="text-sm text-gray-400">Top Score</div>
              </Card>
            )}

          {leaderboardData.agents.length > 0 && (
            <Card className="p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <ChartNoAxesColumn size={20} className="text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">
                  {(
                    leaderboardData.agents.reduce(
                      (sum, agent) => sum + agent.score,
                      0,
                    ) / leaderboardData.agents.length
                  ).toFixed(0)}
                </span>
              </div>
              <div className="text-sm text-gray-400">Average Score</div>
            </Card>
          )}
        </div>

        {/* Leaderboard Table */}
        <div>
          {/* Desktop View */}
          <div className="hidden md:block">
            <ArenaDetailLeaderboardTable agents={allAgents} />
          </div>

          {/* Mobile View */}
          <div className="block md:hidden">
            <ArenaDetailLeaderboardTableMobile agents={allAgents} />
          </div>

          {/* Load More Button */}
          {allAgents.length < leaderboardData.pagination.total && (
            <div className="mt-6 text-center">
              <Button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                variant="outline"
                className="min-w-[200px]"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More Agents
                    <span className="ml-2 text-gray-400">
                      ({allAgents.length} / {leaderboardData.pagination.total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Arena Competitions */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Competitions</h2>
          <Tabs defaultValue="All" className="text-secondary-foreground w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2">
              <TabsTrigger
                value="All"
                className={cn(
                  "rounded border p-2",
                  "data-[state=active]:bg-white data-[state=active]:text-black",
                  "data-[state=inactive]:text-secondary-foreground",
                )}
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="Ongoing"
                className={cn(
                  "rounded border p-2",
                  "data-[state=active]:bg-white data-[state=active]:text-black",
                  "data-[state=inactive]:text-secondary-foreground",
                )}
              >
                Ongoing
              </TabsTrigger>
              <TabsTrigger
                value="Upcoming"
                className={cn(
                  "rounded border p-2",
                  "data-[state=active]:bg-white data-[state=active]:text-black",
                  "data-[state=inactive]:text-secondary-foreground",
                )}
              >
                Upcoming
              </TabsTrigger>
              <TabsTrigger
                value="Complete"
                className={cn(
                  "rounded border p-2",
                  "data-[state=active]:bg-white data-[state=active]:text-black",
                  "data-[state=inactive]:text-secondary-foreground",
                )}
              >
                Complete
              </TabsTrigger>
            </TabsList>

            <TabsContent
              className="flex flex-col gap-x-4 gap-y-10 md:grid md:grid-cols-2"
              value="All"
            >
              {activeComps}
              {upcomingComps}
              {endedComps}
            </TabsContent>

            <TabsContent
              className="flex flex-col gap-x-4 gap-y-10 md:grid md:grid-cols-2"
              value="Ongoing"
            >
              {activeComps}
            </TabsContent>

            <TabsContent
              className="flex flex-col gap-x-4 gap-y-10 md:grid md:grid-cols-2"
              value="Upcoming"
            >
              {upcomingComps}
            </TabsContent>

            <TabsContent
              className="flex flex-col gap-x-4 gap-y-10 md:grid md:grid-cols-2"
              value="Complete"
            >
              {endedComps}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
