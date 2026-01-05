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
            `absolute bottom-[-20] left-[-350px] right-[-350px] top-7 z-10`,
            "bg-gradient-to-r",
            "md:from-8% from-black from-20% via-transparent via-35% to-transparent sm:from-15%",
          )}
        ></div>
        <div
          className={cn(
            `absolute bottom-[-20] left-[-350px] right-[-350px] top-7 z-10`,
            "bg-gradient-to-l",
            "md:from-8% from-black from-20% via-transparent via-35% to-transparent sm:from-15%",
          )}
        ></div>

        <div className="flex h-full w-full items-center justify-center">
          {/* Speed skating race - retro 8-bit style */}
          <SpeedSkatingBanner className="absolute inset-0 z-[8] hidden sm:block" />

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

// Brand colors for skater suits
const LANE_COLORS = ["#E5342A", "#F9B700", "#38A430", "#0064C7"] as const;

// Timing constants (ms) - ~30s race
const TIMING = {
  frameDuration: 150,
  racePhase: 24000,
  victoryPhase: 4000,
  resetPhase: 1000,
  totalLoop: 29000,
  winnerEmergenceStart: 18000,
  iceScrollDuration: 28000,
} as const;

// Layout constants (viewBox units 0-100)
const LAYOUT = {
  skaterBaseX: 3,
  laneYPositions: [20, 38, 56, 74],
  skaterScale: 0.7,
  laneHeight: 2.5,
} as const;

// Race dynamics
const RACE = {
  baseDistance: 15, // How far all skaters move during race
  winnerBonus: 5, // Extra distance winner pulls ahead
  frameStagger: [0, 50, 100, 25],
} as const;

// Colors
const COLORS = {
  skin: "#E8B67C",
  skate: "#6B7280",
  shadow: "#0A0C10",
  iceDark: "#1A1D28",
  iceLight: "#252A36",
} as const;

// Skater body part type - now includes shadow variants for depth
type PartType =
  | "suit"
  | "suitShadow"
  | "skin"
  | "skinShadow"
  | "skate"
  | "skateBlade"
  | "visor";

interface SkaterPart {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: PartType;
}

// Shadow/highlight color helpers
const darken = (hex: string, amount: number = 0.3): string => {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (num >> 16) - Math.floor(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.floor(255 * amount));
  const b = Math.max(0, (num & 0x0000ff) - Math.floor(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

// =============================================================================
// SPEED SKATER - 1985 Epyx Winter Games Style
//
// Reference: Winter Games (1985) by Epyx - Speed Skating event
//
// The skater is in a LOW RACING CROUCH - body nearly HORIZONTAL:
// - Body forms a nearly flat horizontal line from butt to head
// - Head is at the FRONT, facing right, at roughly same height as butt
// - Arms swing in opposition - one back, one forward
// - Supporting leg is bent at knee, foot under body center
// - Pushing leg extends FAR back at an angle
// - Skate blades are LONG and prominent
//
// Sprite dimensions: ~28px wide x 14px tall (at scale 1.0)
// Rendered at scale 0.7 for the banner
// =============================================================================

// Pixel unit - keep at 1 for clean integer math
const _PX = 1;

// -----------------------------------------------------------------------------
// SKATING FRAMES - 3 frame animation cycle
// Frame 0: Left leg pushing back
// Frame 1: Glide (both legs together)
// Frame 2: Right leg pushing back
// -----------------------------------------------------------------------------

const SKATING_FRAMES: SkaterPart[][] = [
  // FRAME 0: Left leg pushing back, right arm back, left arm forward
  [
    // BODY - horizontal torso from butt (left) to head (right)
    { id: "butt", x: 0, y: 4, w: 4, h: 3, type: "suit" },
    { id: "back", x: 4, y: 4, w: 5, h: 3, type: "suit" },
    { id: "backShadow", x: 4, y: 6, w: 5, h: 1, type: "suitShadow" },
    { id: "shoulder", x: 9, y: 4, w: 3, h: 3, type: "suit" },

    // HEAD - rounder helmet shape
    { id: "helmetBack", x: 11, y: 3, w: 2, h: 4, type: "suit" },
    { id: "helmetTop", x: 12, y: 2, w: 3, h: 2, type: "suit" },
    { id: "helmetFront", x: 13, y: 3, w: 3, h: 3, type: "suit" },
    { id: "visor", x: 15, y: 3, w: 2, h: 2, type: "visor" },
    { id: "face", x: 16, y: 5, w: 2, h: 2, type: "skin" },

    // BACK ARM - swinging up and back from shoulder (with gray inner)
    { id: "backArmInner", x: 5, y: 0, w: 1, h: 4, type: "skate" },
    { id: "backArmUpper", x: 6, y: 0, w: 3, h: 3, type: "suit" },
    { id: "backArmLower", x: 3, y: -2, w: 3, h: 3, type: "suit" },
    { id: "backHand", x: 1, y: -3, w: 2, h: 2, type: "skin" },

    // FRONT ARM - swinging down and forward toward ice (with gray inner)
    { id: "frontArmUpper", x: 11, y: 6, w: 2, h: 3, type: "suit" },
    { id: "frontArmInner", x: 13, y: 7, w: 1, h: 4, type: "skate" },
    { id: "frontArmLower", x: 14, y: 9, w: 3, h: 2, type: "suit" },
    { id: "frontHand", x: 16, y: 11, w: 2, h: 2, type: "skin" },

    // RIGHT LEG (supporting) - bent under body (with gray inner)
    { id: "rThighInner", x: 3, y: 7, w: 1, h: 3, type: "skate" },
    { id: "rThigh", x: 4, y: 6, w: 3, h: 4, type: "suit" },
    { id: "rShinInner", x: 2, y: 9, w: 1, h: 4, type: "skate" },
    { id: "rShin", x: 3, y: 9, w: 2, h: 4, type: "suit" },
    { id: "rBoot", x: 1, y: 12, w: 4, h: 2, type: "skate" },
    { id: "rBladeHolder", x: 1, y: 13, w: 4, h: 1, type: "suitShadow" },
    { id: "rBlade", x: -1, y: 14, w: 8, h: 1, type: "skateBlade" },

    // LEFT LEG (pushing) - extended far back (with gray inner)
    { id: "lThighInner", x: -2, y: 6, w: 1, h: 2, type: "skate" },
    { id: "lThigh", x: -1, y: 5, w: 3, h: 2, type: "suit" },
    { id: "lShinInner", x: -7, y: 7, w: 1, h: 2, type: "skate" },
    { id: "lShin", x: -6, y: 6, w: 5, h: 2, type: "suit" },
    { id: "lBoot", x: -11, y: 7, w: 5, h: 2, type: "skate" },
    { id: "lBladeHolder", x: -11, y: 8, w: 5, h: 1, type: "suitShadow" },
    { id: "lBlade", x: -13, y: 9, w: 9, h: 1, type: "skateBlade" },
  ],

  // FRAME 1: Glide - both legs together under body
  [
    // BODY - horizontal
    { id: "butt", x: 0, y: 4, w: 4, h: 3, type: "suit" },
    { id: "back", x: 4, y: 4, w: 5, h: 3, type: "suit" },
    { id: "backShadow", x: 4, y: 6, w: 5, h: 1, type: "suitShadow" },
    { id: "shoulder", x: 9, y: 4, w: 3, h: 3, type: "suit" },

    // HEAD - rounder
    { id: "helmetBack", x: 11, y: 3, w: 2, h: 4, type: "suit" },
    { id: "helmetTop", x: 12, y: 2, w: 3, h: 2, type: "suit" },
    { id: "helmetFront", x: 13, y: 3, w: 3, h: 3, type: "suit" },
    { id: "visor", x: 15, y: 3, w: 2, h: 2, type: "visor" },
    { id: "face", x: 16, y: 5, w: 2, h: 2, type: "skin" },

    // BOTH ARMS - tucked close to body, hands slightly staggered
    { id: "backArmInner", x: 1, y: 1, w: 1, h: 3, type: "skate" },
    { id: "backArm", x: 2, y: 1, w: 2, h: 3, type: "suit" },
    { id: "backHand", x: 1, y: 0, w: 2, h: 2, type: "skin" },
    { id: "frontArm", x: 10, y: 6, w: 2, h: 3, type: "suit" },
    { id: "frontArmInner", x: 12, y: 6, w: 1, h: 3, type: "skate" },
    { id: "frontHand", x: 12, y: 9, w: 2, h: 2, type: "skin" },

    // BOTH LEGS - together under body (with gray inners)
    { id: "lThighInner", x: 1, y: 7, w: 1, h: 3, type: "skate" },
    { id: "lThigh", x: 2, y: 6, w: 3, h: 4, type: "suit" },
    { id: "lShinInner", x: 0, y: 9, w: 1, h: 4, type: "skate" },
    { id: "lShin", x: 1, y: 9, w: 2, h: 4, type: "suit" },
    { id: "lBoot", x: -1, y: 12, w: 4, h: 2, type: "skate" },
    { id: "lBladeHolder", x: -1, y: 13, w: 4, h: 1, type: "suitShadow" },
    { id: "lBlade", x: -3, y: 14, w: 8, h: 1, type: "skateBlade" },

    { id: "rThighInner", x: 8, y: 7, w: 1, h: 3, type: "skate" },
    { id: "rThigh", x: 5, y: 6, w: 3, h: 4, type: "suit" },
    { id: "rShinInner", x: 8, y: 9, w: 1, h: 4, type: "skate" },
    { id: "rShin", x: 6, y: 9, w: 2, h: 4, type: "suit" },
    { id: "rBoot", x: 5, y: 12, w: 4, h: 2, type: "skate" },
    { id: "rBladeHolder", x: 5, y: 13, w: 4, h: 1, type: "suitShadow" },
    { id: "rBlade", x: 3, y: 14, w: 8, h: 1, type: "skateBlade" },
  ],

  // FRAME 2: Right leg pushing back (mirror of frame 0)
  [
    // BODY - horizontal
    { id: "butt", x: 0, y: 4, w: 4, h: 3, type: "suit" },
    { id: "back", x: 4, y: 4, w: 5, h: 3, type: "suit" },
    { id: "backShadow", x: 4, y: 6, w: 5, h: 1, type: "suitShadow" },
    { id: "shoulder", x: 9, y: 4, w: 3, h: 3, type: "suit" },

    // HEAD - rounder
    { id: "helmetBack", x: 11, y: 3, w: 2, h: 4, type: "suit" },
    { id: "helmetTop", x: 12, y: 2, w: 3, h: 2, type: "suit" },
    { id: "helmetFront", x: 13, y: 3, w: 3, h: 3, type: "suit" },
    { id: "visor", x: 15, y: 3, w: 2, h: 2, type: "visor" },
    { id: "face", x: 16, y: 5, w: 2, h: 2, type: "skin" },

    // FRONT ARM - now swinging back from shoulder (with gray inner)
    { id: "frontArmInner", x: 5, y: 0, w: 1, h: 4, type: "skate" },
    { id: "frontArmUpper", x: 6, y: 0, w: 3, h: 3, type: "suit" },
    { id: "frontArmLower", x: 3, y: -2, w: 3, h: 3, type: "suit" },
    { id: "frontHand", x: 1, y: -3, w: 2, h: 2, type: "skin" },

    // BACK ARM - now swinging forward toward ice (with gray inner)
    { id: "backArmUpper", x: 11, y: 6, w: 2, h: 3, type: "suit" },
    { id: "backArmInner", x: 13, y: 7, w: 1, h: 4, type: "skate" },
    { id: "backArmLower", x: 14, y: 9, w: 3, h: 2, type: "suit" },
    { id: "backHand", x: 16, y: 11, w: 2, h: 2, type: "skin" },

    // LEFT LEG (now supporting) - bent under body (with gray inner)
    { id: "lThighInner", x: 3, y: 7, w: 1, h: 3, type: "skate" },
    { id: "lThigh", x: 4, y: 6, w: 3, h: 4, type: "suit" },
    { id: "lShinInner", x: 2, y: 9, w: 1, h: 4, type: "skate" },
    { id: "lShin", x: 3, y: 9, w: 2, h: 4, type: "suit" },
    { id: "lBoot", x: 1, y: 12, w: 4, h: 2, type: "skate" },
    { id: "lBladeHolder", x: 1, y: 13, w: 4, h: 1, type: "suitShadow" },
    { id: "lBlade", x: -1, y: 14, w: 8, h: 1, type: "skateBlade" },

    // RIGHT LEG (now pushing) - extended far back (with gray inner)
    { id: "rThighInner", x: -2, y: 6, w: 1, h: 2, type: "skate" },
    { id: "rThigh", x: -1, y: 5, w: 3, h: 2, type: "suit" },
    { id: "rShinInner", x: -7, y: 7, w: 1, h: 2, type: "skate" },
    { id: "rShin", x: -6, y: 6, w: 5, h: 2, type: "suit" },
    { id: "rBoot", x: -11, y: 7, w: 5, h: 2, type: "skate" },
    { id: "rBladeHolder", x: -11, y: 8, w: 5, h: 1, type: "suitShadow" },
    { id: "rBlade", x: -13, y: 9, w: 9, h: 1, type: "skateBlade" },
  ],
];

// -----------------------------------------------------------------------------
// VICTORY FRAME - Standing upright with arms raised in V
// -----------------------------------------------------------------------------

const VICTORY_FRAME: SkaterPart[] = [
  // HEAD - rounder helmet shape
  { id: "helmetBack", x: 2, y: 0, w: 2, h: 4, type: "suit" },
  { id: "helmetTop", x: 3, y: -1, w: 3, h: 2, type: "suit" },
  { id: "helmetFront", x: 4, y: 0, w: 3, h: 3, type: "suit" },
  { id: "visor", x: 6, y: 0, w: 2, h: 2, type: "visor" },
  { id: "face", x: 7, y: 2, w: 2, h: 2, type: "skin" },

  // TORSO - vertical
  { id: "chest", x: 3, y: 4, w: 4, h: 4, type: "suit" },
  { id: "torsoShadow", x: 3, y: 7, w: 4, h: 1, type: "suitShadow" },

  // LEFT ARM - raised up diagonally (V shape) with gray inner
  { id: "lArmInner", x: 0, y: 4, w: 1, h: 3, type: "skate" },
  { id: "lArmUpper", x: 1, y: 4, w: 2, h: 3, type: "suit" },
  { id: "lArmLowerInner", x: -2, y: 1, w: 1, h: 4, type: "skate" },
  { id: "lArmLower", x: -1, y: 1, w: 3, h: 4, type: "suit" },
  { id: "lHand", x: -2, y: -1, w: 2, h: 2, type: "skin" },

  // RIGHT ARM - raised up diagonally (V shape) with gray inner
  { id: "rArmUpper", x: 7, y: 4, w: 2, h: 3, type: "suit" },
  { id: "rArmInner", x: 9, y: 4, w: 1, h: 3, type: "skate" },
  { id: "rArmLower", x: 8, y: 1, w: 3, h: 4, type: "suit" },
  { id: "rArmLowerInner", x: 11, y: 1, w: 1, h: 4, type: "skate" },
  { id: "rHand", x: 10, y: -1, w: 2, h: 2, type: "skin" },

  // LEFT LEG - standing with gray inner
  { id: "lThighInner", x: 2, y: 8, w: 1, h: 4, type: "skate" },
  { id: "lThigh", x: 3, y: 8, w: 2, h: 4, type: "suit" },
  { id: "lShinInner", x: 1, y: 11, w: 1, h: 3, type: "skate" },
  { id: "lShin", x: 2, y: 11, w: 2, h: 3, type: "suit" },
  { id: "lBoot", x: 0, y: 13, w: 4, h: 2, type: "skate" },
  { id: "lBladeHolder", x: 0, y: 14, w: 4, h: 1, type: "suitShadow" },
  { id: "lBlade", x: -1, y: 15, w: 7, h: 1, type: "skateBlade" },

  // RIGHT LEG - standing with gray inner
  { id: "rThigh", x: 5, y: 8, w: 2, h: 4, type: "suit" },
  { id: "rThighInner", x: 7, y: 8, w: 1, h: 4, type: "skate" },
  { id: "rShin", x: 6, y: 11, w: 2, h: 3, type: "suit" },
  { id: "rShinInner", x: 8, y: 11, w: 1, h: 3, type: "skate" },
  { id: "rBoot", x: 5, y: 13, w: 4, h: 2, type: "skate" },
  { id: "rBladeHolder", x: 5, y: 14, w: 4, h: 1, type: "suitShadow" },
  { id: "rBlade", x: 4, y: 15, w: 7, h: 1, type: "skateBlade" },
];

// -----------------------------------------------------------------------------
// LOSER FRAME - Slumped forward, dejected posture
// -----------------------------------------------------------------------------

const LOSER_FRAME: SkaterPart[] = [
  // HEAD - drooped forward and down, rounder helmet shape
  { id: "helmetBack", x: 6, y: 2, w: 2, h: 4, type: "suit" },
  { id: "helmetTop", x: 7, y: 1, w: 3, h: 2, type: "suit" },
  { id: "helmetFront", x: 8, y: 2, w: 3, h: 3, type: "suit" },
  { id: "visor", x: 10, y: 2, w: 2, h: 2, type: "visor" },
  { id: "face", x: 11, y: 4, w: 2, h: 2, type: "skin" },

  // TORSO - slightly hunched
  { id: "chest", x: 3, y: 3, w: 5, h: 4, type: "suit" },
  { id: "torsoShadow", x: 3, y: 6, w: 5, h: 1, type: "suitShadow" },

  // LEFT ARM - hanging down limply with gray inner
  { id: "lArmInner", x: 1, y: 6, w: 1, h: 5, type: "skate" },
  { id: "lArm", x: 2, y: 6, w: 2, h: 5, type: "suit" },
  { id: "lHand", x: 1, y: 10, w: 2, h: 2, type: "skin" },

  // RIGHT ARM - hanging down limply with gray inner
  { id: "rArm", x: 7, y: 6, w: 2, h: 5, type: "suit" },
  { id: "rArmInner", x: 9, y: 6, w: 1, h: 5, type: "skate" },
  { id: "rHand", x: 8, y: 10, w: 2, h: 2, type: "skin" },

  // LEFT LEG - standing with gray inner and blade holder
  { id: "lThighInner", x: 2, y: 7, w: 1, h: 4, type: "skate" },
  { id: "lThigh", x: 3, y: 7, w: 2, h: 4, type: "suit" },
  { id: "lShinInner", x: 1, y: 10, w: 1, h: 4, type: "skate" },
  { id: "lShin", x: 2, y: 10, w: 2, h: 4, type: "suit" },
  { id: "lBoot", x: 0, y: 13, w: 4, h: 2, type: "skate" },
  { id: "lBladeHolder", x: 0, y: 14, w: 4, h: 1, type: "suitShadow" },
  { id: "lBlade", x: -1, y: 15, w: 7, h: 1, type: "skateBlade" },

  // RIGHT LEG - standing with gray inner and blade holder
  { id: "rThigh", x: 5, y: 7, w: 2, h: 4, type: "suit" },
  { id: "rThighInner", x: 7, y: 7, w: 1, h: 4, type: "skate" },
  { id: "rShin", x: 6, y: 10, w: 2, h: 4, type: "suit" },
  { id: "rShinInner", x: 8, y: 10, w: 1, h: 4, type: "skate" },
  { id: "rBoot", x: 5, y: 13, w: 4, h: 2, type: "skate" },
  { id: "rBladeHolder", x: 5, y: 14, w: 4, h: 1, type: "suitShadow" },
  { id: "rBlade", x: 4, y: 15, w: 7, h: 1, type: "skateBlade" },
];

interface IceChunk {
  x: number;
  width: number;
  dark: boolean;
}

// Generate ice chunks for a lane (deterministic) - covers exactly 100 units for seamless tiling
const generateIceChunks = (laneIndex: number): IceChunk[] => {
  let seed = 12345 + laneIndex * 54321;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const chunks: IceChunk[] = [];
  let x = 0;

  // Generate chunks to cover exactly 100 units (the viewBox width)
  while (x < 100) {
    const width = 3 + random() * 5;
    const gap = 2 + random() * 4;
    const dark = random() > 0.5;
    chunks.push({ x, width, dark });
    x += width + gap;
  }

  return chunks;
};

type RacePhase = "racing" | "victory" | "reset";
type FinishStyle = "pullAhead" | "photoFinish";

interface RaceState {
  phase: RacePhase;
  elapsed: number;
  winnerId: number;
  finishStyle: FinishStyle;
  skaterFrame: number;
  iceOffset: number;
  skaterPositions: number[];
}

/**
 * Speed Skating Banner - Retro 8-bit style racing animation
 * Inspired by 1985 Epyx Winter Games
 */
const SpeedSkatingBanner: React.FC<{ className?: string }> = React.memo(
  ({ className = "" }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const startTimeRef = React.useRef<number | null>(null);
    const lastWinnerRef = React.useRef<number>(-1);
    const [aspectRatio, setAspectRatio] = React.useState(3); // Default banner aspect ratio
    const [state, setState] = React.useState<RaceState>({
      phase: "racing",
      elapsed: 0,
      winnerId: 0,
      finishStyle: "pullAhead",
      skaterFrame: 0,
      iceOffset: 0,
      skaterPositions: [0, 0, 0, 0],
    });

    const prefersReducedMotion =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    // Track container aspect ratio to compensate for SVG stretching
    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateAspectRatio = () => {
        const { width, height } = container.getBoundingClientRect();
        if (height > 0) setAspectRatio(width / height);
      };

      updateAspectRatio();
      const observer = new ResizeObserver(updateAspectRatio);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Pre-generate ice chunks for each lane
    const lanes = React.useMemo(
      () =>
        LAYOUT.laneYPositions.map((y, i) => ({
          id: i,
          color: LANE_COLORS[i]!,
          y,
          chunks: generateIceChunks(i),
        })),
      [],
    );

    // Animation loop
    React.useEffect(() => {
      if (prefersReducedMotion) return;

      let animationId: number;

      const selectNewWinner = (lastWinner: number): number => {
        const weights = [1, 1, 1, 1];
        if (lastWinner >= 0 && Math.random() > 0.25) {
          weights[lastWinner] = 0.1;
        }
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < weights.length; i++) {
          random -= weights[i]!;
          if (random <= 0) return i;
        }
        return 0;
      };

      const selectFinishStyle = (): FinishStyle => {
        return Math.random() < 0.5 ? "pullAhead" : "photoFinish";
      };

      const calculatePositions = (
        elapsed: number,
        phase: RacePhase,
        winnerId: number,
        finishStyle: FinishStyle,
      ): number[] => {
        if (phase === "reset") return [0, 0, 0, 0];

        const raceProgress = Math.min(elapsed / TIMING.racePhase, 1);

        // All skaters race together, with finish style determining how winner emerges
        const positions = [0, 0, 0, 0];

        if (finishStyle === "pullAhead") {
          // Winner pulls ahead visibly in the final stretch
          const emergenceProgress = Math.max(
            0,
            (elapsed - TIMING.winnerEmergenceStart) /
              (TIMING.racePhase - TIMING.winnerEmergenceStart),
          );

          for (let i = 0; i < 4; i++) {
            // Base movement: all skaters move together
            const basePosition = raceProgress * RACE.baseDistance;

            if (i === winnerId) {
              // Winner pulls ahead after emergence point
              positions[i] =
                basePosition + emergenceProgress * RACE.winnerBonus;
            } else {
              // Losers fall slightly behind with staggered amounts
              const lagAmount = ((i + 1) % 3) * 0.5; // Different lag for each loser
              positions[i] = basePosition - emergenceProgress * lagAmount;
            }
          }
        } else {
          // Photo finish: all stay very close, winner only wins by tiny margin at end
          for (let i = 0; i < 4; i++) {
            const basePosition = raceProgress * RACE.baseDistance;
            // Slight random-ish wobble during race (deterministic based on lane)
            const wobble = Math.sin(elapsed / 500 + i * 1.5) * 0.3;

            if (i === winnerId && raceProgress > 0.95) {
              // Winner edges ahead only in very last moment
              positions[i] = basePosition + wobble + 0.5;
            } else {
              positions[i] = basePosition + wobble;
            }
          }
        }

        return positions;
      };

      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const totalElapsed = timestamp - startTimeRef.current;
        const elapsed = totalElapsed % TIMING.totalLoop;

        // Detect loop restart
        const isNewLoop =
          elapsed < state.elapsed && state.elapsed > TIMING.totalLoop * 0.9;

        // Determine phase
        let phase: RacePhase = "racing";
        if (elapsed >= TIMING.racePhase + TIMING.victoryPhase) {
          phase = "reset";
        } else if (elapsed >= TIMING.racePhase) {
          phase = "victory";
        }

        // Select new winner and finish style on loop restart
        let winnerId = state.winnerId;
        let finishStyle = state.finishStyle;
        if (isNewLoop) {
          winnerId = selectNewWinner(lastWinnerRef.current);
          finishStyle = selectFinishStyle();
          lastWinnerRef.current = winnerId;
        }

        const skaterFrame = Math.floor(elapsed / TIMING.frameDuration) % 3;
        const iceOffset = (elapsed / TIMING.iceScrollDuration) * 100;
        const skaterPositions = calculatePositions(
          elapsed,
          phase,
          winnerId,
          finishStyle,
        );

        setState({
          phase,
          elapsed,
          winnerId,
          finishStyle,
          skaterFrame,
          iceOffset,
          skaterPositions,
        });

        animationId = requestAnimationFrame(animate);
      };

      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }, [
      prefersReducedMotion,
      state.elapsed,
      state.winnerId,
      state.finishStyle,
    ]);

    // Get frame for a skater
    const getSkaterFrame = (laneId: number): SkaterPart[] => {
      if (state.phase === "victory") {
        if (laneId === state.winnerId) {
          return VICTORY_FRAME;
        }
        return LOSER_FRAME;
      }
      const staggeredFrame =
        (state.skaterFrame +
          Math.floor(RACE.frameStagger[laneId]! / TIMING.frameDuration)) %
        3;
      return SKATING_FRAMES[staggeredFrame]!;
    };

    // Render a single skater
    // NOTE: We use a fixed sprite scale, NOT stretched by aspect ratio
    // This keeps the human proportions correct regardless of container shape
    const renderSkater = (
      x: number,
      y: number,
      color: string,
      frame: SkaterPart[],
    ) => {
      const scale = LAYOUT.skaterScale;
      // Ground shadow position - at blade level (y=14-15 depending on frame)
      // Center it under the body (around x=4 for skating, x=4 for standing)
      const shadowY = 15 * scale;
      const shadowCx = 4 * scale;
      const shadowWidth = 10 * scale;

      // Precompute shadow color for this skater
      const suitShadowColor = darken(color, 0.35);
      const skinShadowColor = darken(COLORS.skin, 0.25);
      const bladeHighlight = "#C0C8D0"; // Shiny blade
      const visorColor = "#7A8A9A"; // Reflective goggle visor

      // Get fill color based on part type
      const getPartColor = (part: SkaterPart): string => {
        switch (part.type) {
          case "suit":
            return color;
          case "suitShadow":
            return suitShadowColor;
          case "skin":
            return COLORS.skin;
          case "skinShadow":
            return skinShadowColor;
          case "skate":
            return COLORS.skate;
          case "skateBlade":
            return bladeHighlight;
          case "visor":
            return visorColor;
          default:
            return color;
        }
      };

      // Compensate for SVG aspect ratio stretching
      // The SVG uses preserveAspectRatio="none" which stretches horizontally
      // Divide horizontal dimensions by aspectRatio to maintain sprite proportions
      const hScale = scale / aspectRatio;
      const vScale = scale;

      return (
        <g transform={`translate(${x}, ${y})`}>
          {/* Ground shadow - ellipse at ice level */}
          <ellipse
            cx={(shadowCx * hScale) / scale}
            cy={shadowY}
            rx={((shadowWidth / 2) * hScale) / scale}
            ry={0.6 * vScale}
            fill={COLORS.shadow}
            opacity={0.3}
          />
          {/* Body parts - rendered in array order, with aspect ratio compensation */}
          {frame.map((part) => (
            <rect
              key={part.id}
              x={part.x * hScale}
              y={part.y * vScale}
              width={part.w * hScale}
              height={part.h * vScale}
              fill={getPartColor(part)}
            />
          ))}
        </g>
      );
    };

    // Render ice chunks for a lane - seamless tiling with two copies
    const renderIceChunks = (chunks: IceChunk[], y: number) => {
      const offset = state.iceOffset % 100; // Wrap at 100 for seamless loop
      const elements: React.ReactNode[] = [];

      // Render two copies of the pattern side-by-side for seamless scrolling
      chunks.forEach((chunk, i) => {
        // First copy (offset)
        const x1 = chunk.x - offset;
        if (x1 > -15 && x1 < 110) {
          elements.push(
            <rect
              key={`a${i}`}
              x={x1}
              y={y}
              width={chunk.width}
              height={LAYOUT.laneHeight}
              fill={chunk.dark ? COLORS.iceDark : COLORS.iceLight}
            />,
          );
        }

        // Second copy (offset - 100, wraps around)
        const x2 = chunk.x - offset + 100;
        if (x2 > -15 && x2 < 110) {
          elements.push(
            <rect
              key={`b${i}`}
              x={x2}
              y={y}
              width={chunk.width}
              height={LAYOUT.laneHeight}
              fill={chunk.dark ? COLORS.iceDark : COLORS.iceLight}
            />,
          );
        }
      });

      return elements;
    };

    return (
      <div
        ref={containerRef}
        className={cn(
          "pointer-events-none select-none overflow-hidden",
          className,
        )}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Animated speed skating race"
        >
          <title>Speed Skating Race</title>

          {lanes.map((lane) => (
            <g key={lane.id}>
              {/* Ice lane */}
              {renderIceChunks(lane.chunks, lane.y + 6)}

              {/* Skater */}
              {renderSkater(
                LAYOUT.skaterBaseX + state.skaterPositions[lane.id]!,
                lane.y,
                lane.color,
                getSkaterFrame(lane.id),
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  },
);
SpeedSkatingBanner.displayName = "SpeedSkatingBanner";
