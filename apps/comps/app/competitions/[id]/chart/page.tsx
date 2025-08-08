"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { ChartSkeleton, TimelineChart } from "@/components/timeline-chart";
import { useCompetition } from "@/hooks/useCompetition";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";

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
  } = useCompetition(id);

  const {
    data: agentsData,
    isLoading: agentsLoading,
    error: agentsError,
  } = useCompetitionAgents(id, {
    limit: 10, // Default page size
    offset: 0,
  });

  if (competitionLoading || agentsLoading) {
    return (
      <div className="bg-background min-h-screen p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-center">
            <Skeleton className="mx-auto mb-1 mt-1 h-9 w-64" />
            <Skeleton className="mx-auto h-5 w-40" />
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

  const handlePageChange = () => {
    // Note: For standalone chart, we don't implement pagination
    // Users should go to the main competition page for full functionality
  };

  return (
    <div className="bg-background min-h-screen p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-bold text-white">{competition.name}</h1>
          <p className="text-gray-400">Portfolio Timeline</p>
        </div>

        <TimelineChart
          competition={competition}
          agents={agentsData?.agents || []}
          totalAgents={agentsData?.pagination?.total || 0}
          currentPage={1}
          onPageChange={handlePageChange}
          className="shadow-2xl"
          suppressInternalLoading={true}
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
