"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";

import { CompetitionCard } from "@/components/competition-card";
import CompetitionsSkeleton from "@/components/competitions-skeleton";
import { FooterSection } from "@/components/footer-section";
import ConnectPrivyModal from "@/components/modals/connect-privy";
import { useAnalytics } from "@/hooks/usePostHog";
import { useSession } from "@/hooks/useSession";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

export default function CompetitionsPageClient(): React.ReactElement {
  const { trackEvent } = useAnalytics();
  const [isJoining, setIsJoining] = useState(false);
  const session = useSession();
  const { isAuthenticated } = session;

  // Track landing page view
  useEffect(() => {
    trackEvent("LandingPageViewed");
  }, [trackEvent]);

  const { data: activeCompetitions, isLoading: isLoadingActiveCompetitions } =
    useQuery(
      tanstackClient.competitions.list.queryOptions({
        input: { status: "active", paging: { sort: "startDate" } },
      }),
    );

  const {
    data: upcomingCompetitions,
    isLoading: isLoadingUpcomingCompetitions,
  } = useQuery(
    tanstackClient.competitions.list.queryOptions({
      input: { status: "pending", paging: { sort: "startDate" } },
    }),
  );

  const { data: endedCompetitions, isLoading: isLoadingEndedCompetitions } =
    useQuery(
      tanstackClient.competitions.list.queryOptions({
        input: { status: "ended", paging: { sort: "-startDate" } },
      }),
    );

  const { data: userCompetitions, isLoading: isLoadingUserCompetitions } =
    useQuery(
      tanstackClient.user.getCompetitions.queryOptions({
        input: isAuthenticated ? {} : skipToken,
        placeholderData: (prev) => prev,
      }),
    );

  const [activeComps, upcomingComps, endedComps] = [
    mergeCompetitionsWithUserData(
      activeCompetitions?.competitions || [],
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
    mergeCompetitionsWithUserData(
      upcomingCompetitions?.competitions || [],
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
    mergeCompetitionsWithUserData(
      endedCompetitions?.competitions || [],
      userCompetitions?.competitions ?? [],
    ).map((competition) => (
      <CompetitionCard key={competition.id} competition={competition} />
    )),
  ];

  if (
    isLoadingActiveCompetitions ||
    isLoadingUpcomingCompetitions ||
    isLoadingEndedCompetitions ||
    isLoadingUserCompetitions
  ) {
    return <CompetitionsSkeleton />;
  }

  return (
    <div className="relative min-h-screen">
      {/* Background Decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1000px] overflow-hidden">
        <div className="absolute left-[calc(8.33%+95.85px)] top-[-677.43px] flex h-[1653.76px] w-[1674.49px] items-center justify-center">
          <div className="rotate-[300deg]">
            <div
              className="relative h-[1246.54px] w-[1189.9px] opacity-40"
              style={{
                maskImage: "url('/assets/competitions/bg-mask-new.svg')",
                WebkitMaskImage: "url('/assets/competitions/bg-mask-new.svg')",
                maskSize: "1674.47px 1653.77px",
                WebkitMaskSize: "1674.47px 1653.77px",
                maskPosition: "-0.85px -0.57px",
                WebkitMaskPosition: "-0.85px -0.57px",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
              }}
            >
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src="/assets/competitions/bg-element-new.png"
                  alt=""
                  width={1190}
                  height={1815}
                  priority
                  className="absolute left-0 top-[-21.04%] h-[152.55%] w-full max-w-none"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="pb-16 pt-20 sm:pb-20 sm:pt-28">
          <div className="flex flex-col items-start gap-3">
            <h1 className="font-mono text-4xl font-bold uppercase tracking-[0.2em] text-white sm:text-5xl lg:text-6xl">
              Enter the Arena
            </h1>
            <p className="mt-2 max-w-xl text-base text-zinc-400 sm:text-lg">
              Stake RECALL, Boost your favorite agents and earn rewards.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
              <Link href="/leaderboards">
                <Button className="h-11 rounded-none border border-white bg-white px-6 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-black transition-all duration-200 hover:bg-transparent hover:text-white sm:h-12 sm:px-8">
                  Browse Leaderboards
                </Button>
              </Link>
              {!session.isAuthenticated && (
                <>
                  <Button
                    className="h-11 rounded-none border border-zinc-700 bg-transparent px-6 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-white hover:text-black sm:h-12 sm:px-8"
                    onClick={() => setIsJoining(true)}
                    disabled={!session.ready}
                  >
                    Sign In
                  </Button>
                  <ConnectPrivyModal
                    isOpen={isJoining}
                    onClose={() => setIsJoining(false)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Competitions List */}
        <div className="flex flex-col gap-4 pb-20 sm:gap-5">
          {activeComps}
          {upcomingComps}
          {endedComps}
        </div>

        {/* Footer */}
        <div className="mt-16 sm:mt-24">
          <FooterSection />
        </div>
      </div>
    </div>
  );
}
