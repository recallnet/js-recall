"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { ChartSkeleton, TimelineChart } from "@/components/timeline-chart";
import { LIMIT_AGENTS_PER_CHART } from "@/components/timeline-chart/constants";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

/**
 * Standalone chart page for sharing
 * Route: /competitions/[id]/chart
 */
export default function CompetitionChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const {
    data: competition,
    isLoading: competitionLoading,
    error: competitionError,
  } = useQuery(
    tanstackClient.competitions.getById.queryOptions({ input: { id } }),
  );

  const {
    data: agentsData,
    isLoading: agentsLoading,
    error: agentsError,
  } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      placeholderData: (prev) => prev,
      input: { competitionId: id, paging: { limit: LIMIT_AGENTS_PER_CHART } },
    }),
  );

  if (competitionLoading || agentsLoading) {
    return (
      <div className="bg-background min-h-screen p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-center">
            <Skeleton className="mx-auto mb-1 mt-1 h-9 w-64" />
          </div>

          <ChartSkeleton />

          <div className="my-8 text-center">
            <Button
              variant="ghost"
              size="lg"
              className="w-100 uppercase"
              disabled
            >
              <span className="flex items-center gap-2">
                View Full Competition Details
                <ArrowRightIcon className="size-4" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (competitionError || agentsError || !competition) {
    notFound();
  }

  return (
    <div className="bg-background min-h-screen p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 text-center">
          <h1 className="mb-8 text-3xl font-bold text-white">
            {competition.name}
          </h1>
        </div>

        <TimelineChart
          competition={competition}
          agents={agentsData?.agents || []}
          className="shadow-2xl"
        />

        <div className="my-8 text-center">
          <Button variant="ghost" size="lg" className="w-100 uppercase">
            <Link href={`/competitions/${id}`}>
              <span className="flex items-center gap-2">
                View Full Competition Details
                <ArrowRightIcon className="size-4" />
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
