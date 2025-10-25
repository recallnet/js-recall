"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { CompetitionCard } from "@/components/competition-card";
import CompetitionsSkeleton from "@/components/competitions-skeleton";
import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import ConnectPrivyModal from "@/components/modals/connect-privy";
import { config } from "@/config/public";
import { getSocialLinksArray } from "@/data/social";
import { useLeaderboards } from "@/hooks/useLeaderboards";
import { useAnalytics } from "@/hooks/usePostHog";
import { useSession } from "@/hooks/useSession";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";
import { toOrdinal } from "@/utils/format";

export default function CompetitionsPageClient() {
  const { trackEvent } = useAnalytics();
  const [isJoining, setIsJoining] = useState(false);
  const { data: leaderboard, isLoading: isLoadingLeaderboard } =
    useLeaderboards({ limit: 25 }, !config.publicFlags.disableLeaderboard);
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

  const carouselContent = React.useMemo(() => {
    if (isLoadingLeaderboard) return [];

    const carouselContent = leaderboard?.agents.map((agent, i) => (
      <span key={i} className="text-black">
        {`${agent.name} `}
        <span className="font-bold">{toOrdinal(agent.rank)}</span>
      </span>
    ));

    return carouselContent || [];
  }, [leaderboard, isLoadingLeaderboard]);

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
    isLoadingUserCompetitions ||
    isLoadingLeaderboard
  ) {
    return <CompetitionsSkeleton />;
  }

  return (
    <div>
      <div className="h-120 relative left-1/2 top-[-41] w-full -translate-x-1/2 transform pt-40">
        {carouselContent.length > 0 &&
          !config.publicFlags.disableLeaderboard && (
            <HeroCarousel
              className="absolute left-[-350px] right-[-350px] top-6"
              texts={carouselContent}
            />
          )}

        <div
          className={cn(
            `absolute bottom-[-20] left-[-350px] right-[-350px] top-6 z-10`,
            "bg-gradient-to-r",
            "md:from-8% from-black from-20% via-transparent via-35% to-transparent sm:from-15%",
          )}
        ></div>
        <div
          className={cn(
            `absolute bottom-[-20] left-[-350px] right-[-350px] top-6 z-10`,
            "bg-gradient-to-l",
            "md:from-8% from-black from-20% via-transparent via-35% to-transparent sm:from-15%",
          )}
        ></div>

        <div className="flex h-full w-full items-center justify-center">
          <RainbowStripes className="absolute left-0 hidden w-[50%] translate-x-[-70%] sm:block md:translate-x-[-50%]" />

          <div className="z-20 flex translate-y-[-50px] flex-col items-center text-center">
            <h1 className="text-primary-foreground mb-1 text-7xl font-bold sm:text-[83px]">
              Enter the Arena
            </h1>
            <p className="text-primary-foreground mb-8 text-sm">
              {/* Stake tokens, back the smartest trading bots, and earn rewards. */}
            </p>

            <div className="flex gap-1">
              <Link href="/leaderboards">
                <Button className="border border-blue-500 bg-blue-500 p-6 uppercase text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-blue-500">
                  Browse Leaderboards
                </Button>
              </Link>
              {!session.isAuthenticated && (
                <>
                  <Button
                    className="border border-[#303846] bg-black p-6 text-white transition-colors duration-200 hover:bg-white hover:text-black"
                    onClick={() => setIsJoining(true)}
                    disabled={!session.ready}
                  >
                    SIGN IN
                  </Button>
                  <ConnectPrivyModal
                    isOpen={isJoining}
                    onClose={() => setIsJoining(false)}
                  />
                </>
              )}
            </div>
          </div>

          <RainbowStripes
            className="absolute right-0 hidden w-[50%] translate-x-[70%] sm:block md:translate-x-[50%]"
            direction="left"
          />
        </div>
      </div>

      <Tabs
        defaultValue="All"
        className="text-secondary-foreground mb-10 w-full pt-2"
      >
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

      <JoinSwarmSection socialLinks={getSocialLinksArray()} />
      <FooterSection />
    </div>
  );
}

interface HeroCarouselProps {
  texts: React.ReactNode[];
  className?: string;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({
  texts,
  className = "",
}) => {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
    },
    [
      AutoScroll({
        playOnInit: true,
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ],
  );

  // at least 15 elements. The carousel must be filled to work
  const multiplyContent =
    Math.floor(15 / texts.length) + Number(8 % texts.length != 0);
  const content = Array.from({ length: multiplyContent }, () => [
    ...texts,
  ]).flat();
  const renderComponent = (component: React.ReactNode, index: number) => (
    <div key={index} className="text-nowrap text-lg uppercase text-gray-800">
      {component}
    </div>
  );
  const sparkle = (
    <svg
      width="15"
      height="15"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.60786 0.213545C3.61749 0.00164161 3.96617 -0.0831173 4.0702 0.101817C4.5595 0.968696 5.39171 2.24204 6.33564 2.82189C7.27958 3.39981 8.79373 3.56548 9.78775 3.60786C9.99965 3.61749 10.0825 3.96617 9.89755 4.0702C9.03067 4.5595 7.75925 5.39171 7.1794 6.33564C6.59956 7.27958 6.43581 8.79373 6.39343 9.78775C6.3838 9.99965 6.0332 10.0825 5.9311 9.89755C5.44179 9.03067 4.60959 7.75925 3.66373 7.17941C2.71979 6.59956 1.20564 6.43581 0.213548 6.39343C0.0016441 6.3838 -0.0831185 6.0332 0.101816 5.9311C0.968695 5.44179 2.24205 4.60959 2.82189 3.66373C3.39981 2.71979 3.56548 1.20564 3.60786 0.213545Z"
        fill="#11121A"
      />
    </svg>
  );

  return (
    <div className={`bg-white py-4 ${className}`}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-10">
          {content.map((component, index) => (
            <div
              key={index}
              className={cn("flex items-center gap-10", index == 0 && "ml-10")}
            >
              {renderComponent(component, index)}
              {sparkle}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface RainbowStripesProps {
  direction?: "left" | "right";
  width?: string;
  height?: string;
  className?: string;
}

const RainbowStripes: React.FC<RainbowStripesProps> = ({
  direction = "right",
  className = "",
}) => {
  const colors = [
    "var(--hero-red)", // Red
    "var(--hero-yellow)", // Yellow
    "var(--hero-green)", // Green
    "var(--hero-blue)", // Blue
    "var(--hero-black)", // Black
  ];

  // Create the clip-path for the triangular spike
  const clipPath =
    direction === "right"
      ? "polygon(0 0, calc(100% - 140px) 0, 100% 80%, 100% 100%, 0 100%)"
      : "polygon(calc(0% + 140px) 0, 100% 0, 100% 100%, 0% 100%, 0% 80% )";

  return (
    <div className={className}>
      <div className="relative h-60">
        {colors.map((color, index) => (
          <div
            key={index}
            className={cn(`h-45 absolute w-full`)}
            style={{
              backgroundColor: color,
              clipPath: clipPath,
              top: `calc(38px * ${index})`,
              transform: `translateX(${index * 30 * (direction === "right" ? 1 : -1)}px)`,
            }}
          >
            {index != colors.length - 1 && (
              <div
                className={cn(
                  "absolute z-20 h-full w-full",
                  "bg-[length:250%_250%,100%_100%] bg-no-repeat",
                  direction === "right"
                    ? `bg-[linear-gradient(60deg,transparent_47%,rgba(255,255,255,0.4)_50%,transparent_52%,transparent_100%)]`
                    : `bg-[linear-gradient(120deg,transparent_47%,rgba(255,255,255,0.4)_50%,transparent_52%,transparent_100%)]`,
                )}
                style={{
                  animation: "shine 6s ease-in-out infinite",
                  animationDirection:
                    direction === "right" ? "reverse" : "normal",
                  // right and left dirs hit on different times
                  // a small time variation depending on the index
                  animationDelay:
                    direction === "right"
                      ? `${1.9 + Math.random() * 0.2}s`
                      : `${Math.random() * 0.2}s`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
