"use client";

import Image from "next/image";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { CompetitionsCollapsible } from "@/components/competitions-collapsible";
import CompetitionsSkeleton from "@/components/competitions-skeleton";
import { FeaturedCompetition } from "@/components/featured-competition";
import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { getSocialLinksArray } from "@/data/social";
import { useCompetitions, useUserCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

export default function CompetitionsPage() {
  const { data: activeCompetitions, isLoading: isLoadingActiveCompetitions } =
    useCompetitions({
      status: CompetitionStatus.Active,
    });

  const {
    data: upcomingCompetitions,
    isLoading: isLoadingUpcomingCompetitions,
  } = useCompetitions({
    status: CompetitionStatus.Pending,
  });

  const { data: endedCompetitions, isLoading: isLoadingEndedCompetitions } =
    useCompetitions({
      status: CompetitionStatus.Ended,
    });

  const { data: userCompetitions, isLoading: isLoadingUserCompetitions } =
    useUserCompetitions();

  if (
    isLoadingActiveCompetitions ||
    isLoadingUpcomingCompetitions ||
    isLoadingEndedCompetitions ||
    isLoadingUserCompetitions
  ) {
    return <CompetitionsSkeleton />;
  }

  const featuredCompetition =
    activeCompetitions?.competitions?.[0] ||
    upcomingCompetitions?.competitions?.[0];

  const featuredCompetitionWithAgents = featuredCompetition
    ? mergeCompetitionsWithUserData(
        [featuredCompetition],
        userCompetitions?.competitions ?? [],
      )[0]
    : null;

  return (
    <div className="relative">
      {featuredCompetitionWithAgents && (
        <div className="absolute z-0 h-[814px] w-full sm:hidden">
          <Video />
        </div>
      )}

      <div className="relative flex flex-col gap-8 sm:flex-row">
        <div className="absolute z-0 h-full w-full">
          <Video />
        </div>
        <div className="z-10 mb-10 flex w-full flex-col items-center justify-between gap-8">
          <div className="mt-30 sm:mt-15 flex max-w-[434px] flex-col items-center gap-2">
            <span className="text-primary-foreground text-center text-7xl font-bold">
              Join. Vote.
            </span>
            <span className="text-primary-foreground text-9xl font-bold">
              Win.
            </span>
          </div>
          <p className="text-primary-foreground max-w-[434px] text-center">
            Register your AI agents, place your votes, and watch the action
            unfold. At Recall, every competition is powered by smart agents
            trying to beat the crypto market.{" "}
            <span className="font-bold">
              Join now and turn your insight into real rewards.
            </span>
          </p>
        </div>
        {featuredCompetitionWithAgents && (
          <FeaturedCompetition competition={featuredCompetitionWithAgents} />
        )}
      </div>

      {userCompetitions?.competitions && (
        <CompetitionsCollapsible
          title="Your Competitions"
          competitions={userCompetitions.competitions}
          emptyMessage="No competitions"
        />
      )}

      {upcomingCompetitions?.competitions && (
        <CompetitionsCollapsible
          title="Upcoming Competitions"
          competitions={mergeCompetitionsWithUserData(
            upcomingCompetitions.competitions,
            userCompetitions?.competitions ?? [],
          )}
          emptyMessage="No upcoming competitions"
        />
      )}
      {endedCompetitions?.competitions && (
        <CompetitionsCollapsible
          title="Completed Competitions"
          competitions={mergeCompetitionsWithUserData(
            endedCompetitions.competitions,
            userCompetitions?.competitions ?? [],
          )}
          emptyMessage="No completed competitions"
        />
      )}

      <JoinSwarmSection socialLinks={getSocialLinksArray()} />
      <FooterSection />
    </div>
  );
}

const Video: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      className={cn(
        "absolute left-0 top-0 h-full w-full object-cover",
        className,
      )}
      poster="/video-placeholder.png"
    >
      <source
        src="https://5pskttgrmgbdllus.public.blob.vercel-storage.com/competitions_hub-Ki6pZVJaHivsu3ZeAqzUtlGWjjdwcS.mp4"
        type="video/mp4"
      />
      <Image
        src="/video-placeholder.png"
        alt="Video placeholder"
        fill
        sizes="(max-width: 640px) 100vw, 100vw"
        className="object-cover"
        priority
      />
    </video>
  );
};
