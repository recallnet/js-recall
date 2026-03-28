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
          {/* F1 race - retro pixel-art style */}
          <F1RaceBanner className="absolute inset-0 z-[8] hidden sm:block" />

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

// =============================================================================
// F1 RACE BANNER - Retro pixel-art F1 race animation
// 4 cars race left-to-right, winner pulls ahead, checkered flag on victory
// =============================================================================

// F1 team livery colors
const LANE_COLORS = ["#E8002D", "#FF8000", "#00594F", "#0037FF"] as const;

// Timing constants (ms) - ~30s race
const TIMING = {
  frameDuration: 100,
  racePhase: 24000,
  victoryPhase: 4000,
  resetPhase: 1000,
  totalLoop: 29000,
  winnerEmergenceStart: 18000,
  trackScrollDuration: 16000,
} as const;

// Layout constants (viewBox units 0-100)
const LAYOUT = {
  carBaseX: 3,
  laneYPositions: [20, 38, 56, 74],
  carScale: 0.7,
  laneHeight: 2.5,
} as const;

// Race dynamics
const RACE = {
  baseDistance: 15,
  winnerBonus: 5,
  frameStagger: [0, 33, 66, 16],
} as const;

// Colors
const COLORS = {
  tire: "#111318",
  rim: "#707880",
  rimHighlight: "#B8C0C8",
  cockpit: "#080A0F",
  shadow: "#0A0C10",
  trackDark: "#141620",
  trackMid: "#1C1F2C",
  trackLight: "#22263A",
} as const;

type CarPartType =
  | "body"
  | "bodyShadow"
  | "cockpit"
  | "tire"
  | "rim"
  | "rimHighlight";

interface CarPart {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: CarPartType;
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
// F1 CAR SPRITE - Side profile facing right
//
// Bounding box: ~31 wide x 14 tall (at scale 1.0)
// Rendered at scale 0.7 for the banner
//
// Layout (y increases downward):
//   y0-2:  rear wing plate + halo arch
//   y2-5:  cockpit surround + halo pillars
//   y3-8:  main body + nose
//   y7-9:  front wing
//   y8-13: tires (stick out below body)
// =============================================================================

// Static body parts (same across all animation frames)
const CAR_BODY_STATIC: CarPart[] = [
  // REAR WING
  { id: "rwPlate", x: 22, y: 0, w: 9, h: 2, type: "body" },
  { id: "rwPillarL", x: 23, y: 2, w: 2, h: 3, type: "bodyShadow" },
  { id: "rwPillarR", x: 26, y: 2, w: 2, h: 3, type: "bodyShadow" },

  // HALO ARCH
  { id: "haloTop", x: 11, y: 0, w: 7, h: 2, type: "body" },
  { id: "haloL", x: 10, y: 1, w: 2, h: 4, type: "body" },
  { id: "haloR", x: 17, y: 1, w: 2, h: 4, type: "body" },
  { id: "cockpitSurr", x: 10, y: 2, w: 9, h: 3, type: "body" },
  { id: "cockpitDark", x: 11, y: 2, w: 7, h: 3, type: "cockpit" },

  // NOSE
  { id: "noseTip", x: 0, y: 6, w: 3, h: 1, type: "body" },
  { id: "noseMain", x: 2, y: 5, w: 4, h: 2, type: "body" },
  { id: "noseShadow", x: 0, y: 7, w: 6, h: 1, type: "bodyShadow" },

  // MAIN BODY
  { id: "bodyMain", x: 5, y: 3, w: 18, h: 5, type: "body" },
  { id: "bodyShad", x: 5, y: 7, w: 18, h: 1, type: "bodyShadow" },

  // REAR BODY SECTION
  { id: "rearBody", x: 22, y: 3, w: 6, h: 5, type: "body" },
  { id: "rearShad", x: 22, y: 7, w: 6, h: 1, type: "bodyShadow" },

  // FRONT WING
  { id: "fwFlat", x: 0, y: 8, w: 9, h: 1, type: "body" },
  { id: "fwEpL", x: 0, y: 7, w: 1, h: 2, type: "body" },
  { id: "fwEpR", x: 8, y: 7, w: 1, h: 2, type: "body" },
  { id: "fwSupport", x: 3, y: 7, w: 2, h: 2, type: "bodyShadow" },
];

const makeTires = (): CarPart[] => [
  { id: "fTire", x: 2, y: 8, w: 6, h: 5, type: "tire" },
  { id: "rTire", x: 21, y: 8, w: 6, h: 5, type: "tire" },
];

// Rim parts with animated spoke (3 frames = vertical / diagonal / horizontal)
const makeRims = (frame: 0 | 1 | 2): CarPart[] => {
  const parts: CarPart[] = [
    { id: "fRim", x: 3, y: 9, w: 4, h: 3, type: "rim" },
    { id: "rRim", x: 22, y: 9, w: 4, h: 3, type: "rim" },
  ];
  if (frame === 0) {
    // vertical spoke
    parts.push({ id: "fSpoke", x: 4, y: 8, w: 2, h: 5, type: "rimHighlight" });
    parts.push({ id: "rSpoke", x: 23, y: 8, w: 2, h: 5, type: "rimHighlight" });
  } else if (frame === 1) {
    // diagonal spoke (approximated with two small rects)
    parts.push({ id: "fSp1", x: 5, y: 8, w: 1, h: 2, type: "rimHighlight" });
    parts.push({ id: "fSp2", x: 3, y: 11, w: 1, h: 2, type: "rimHighlight" });
    parts.push({ id: "rSp1", x: 24, y: 8, w: 1, h: 2, type: "rimHighlight" });
    parts.push({ id: "rSp2", x: 22, y: 11, w: 1, h: 2, type: "rimHighlight" });
  } else {
    // horizontal spoke
    parts.push({ id: "fSpoke", x: 2, y: 10, w: 6, h: 1, type: "rimHighlight" });
    parts.push({
      id: "rSpoke",
      x: 21,
      y: 10,
      w: 6,
      h: 1,
      type: "rimHighlight",
    });
  }
  return parts;
};

// 3 driving frames (tires first so body renders on top, then rims on top of everything)
const DRIVING_FRAMES: CarPart[][] = [
  [...makeTires(), ...CAR_BODY_STATIC, ...makeRims(0)],
  [...makeTires(), ...CAR_BODY_STATIC, ...makeRims(1)],
  [...makeTires(), ...CAR_BODY_STATIC, ...makeRims(2)],
];

// Victory: car stopped, wheels at vertical spoke
const VICTORY_FRAME: CarPart[] = [
  ...makeTires(),
  ...CAR_BODY_STATIC,
  ...makeRims(0),
];

// Loser: car stopped, wheels at horizontal spoke
const LOSER_FRAME: CarPart[] = [
  ...makeTires(),
  ...CAR_BODY_STATIC,
  ...makeRims(2),
];

interface TrackChunk {
  x: number;
  width: number;
  shade: "dark" | "mid" | "light";
}

// Generate asphalt texture chunks for a lane (deterministic, seamless 100-unit tile)
const generateTrackChunks = (laneIndex: number): TrackChunk[] => {
  let seed = 11111 + laneIndex * 77777;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const chunks: TrackChunk[] = [];
  let x = 0;

  while (x < 100) {
    const width = 5 + random() * 12;
    const gap = 2 + random() * 5;
    const r = random();
    const shade: TrackChunk["shade"] =
      r < 0.33 ? "dark" : r < 0.66 ? "mid" : "light";
    chunks.push({ x, width, shade });
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
  carFrame: number;
  trackOffset: number;
  carPositions: number[];
}

/**
 * F1 Race Banner - Retro pixel-art F1 race animation
 */
const F1RaceBanner: React.FC<{ className?: string }> = React.memo(
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
      carFrame: 0,
      trackOffset: 0,
      carPositions: [0, 0, 0, 0],
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

    // Pre-generate track texture chunks for each lane
    const lanes = React.useMemo(
      () =>
        LAYOUT.laneYPositions.map((y, i) => ({
          id: i,
          color: LANE_COLORS[i]!,
          y,
          chunks: generateTrackChunks(i),
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

        const carFrame = Math.floor(elapsed / TIMING.frameDuration) % 3;
        const trackOffset = (elapsed / TIMING.trackScrollDuration) * 100;
        const carPositions = calculatePositions(
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
          carFrame,
          trackOffset,
          carPositions,
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

    // Get the correct car frame for a given lane
    const getCarFrame = (laneId: number): CarPart[] => {
      if (state.phase === "victory") {
        return laneId === state.winnerId ? VICTORY_FRAME : LOSER_FRAME;
      }
      const staggeredFrame =
        (state.carFrame +
          Math.floor(RACE.frameStagger[laneId]! / TIMING.frameDuration)) %
        3;
      return DRIVING_FRAMES[staggeredFrame]!;
    };

    // Render a single F1 car
    // Sprite scale is fixed; horizontal dims are compensated for SVG stretch
    const renderCar = (
      x: number,
      y: number,
      color: string,
      frame: CarPart[],
    ) => {
      const scale = LAYOUT.carScale;
      const shadowY = 13 * scale;
      const shadowCx = 14 * scale;
      const shadowWidth = 26 * scale;

      const bodyShadowColor = darken(color, 0.35);

      const getPartColor = (part: CarPart): string => {
        switch (part.type) {
          case "body":
            return color;
          case "bodyShadow":
            return bodyShadowColor;
          case "cockpit":
            return COLORS.cockpit;
          case "tire":
            return COLORS.tire;
          case "rim":
            return COLORS.rim;
          case "rimHighlight":
            return COLORS.rimHighlight;
          default:
            return color;
        }
      };

      const hScale = scale / aspectRatio;
      const vScale = scale;

      return (
        <g transform={`translate(${x}, ${y})`}>
          {/* Ground shadow */}
          <ellipse
            cx={(shadowCx * hScale) / scale}
            cy={shadowY}
            rx={((shadowWidth / 2) * hScale) / scale}
            ry={0.4 * vScale}
            fill={COLORS.shadow}
            opacity={0.25}
          />
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

    // Render asphalt texture for a lane - seamless two-copy scrolling
    const renderTrackChunks = (chunks: TrackChunk[], y: number) => {
      const offset = state.trackOffset % 100;
      const elements: React.ReactNode[] = [];

      const shadeColor = (shade: TrackChunk["shade"]) => {
        if (shade === "dark") return COLORS.trackDark;
        if (shade === "mid") return COLORS.trackMid;
        return COLORS.trackLight;
      };

      chunks.forEach((chunk, i) => {
        const color = shadeColor(chunk.shade);

        const x1 = chunk.x - offset;
        if (x1 > -20 && x1 < 110) {
          elements.push(
            <rect
              key={`a${i}`}
              x={x1}
              y={y}
              width={chunk.width}
              height={LAYOUT.laneHeight}
              fill={color}
            />,
          );
        }

        const x2 = chunk.x - offset + 100;
        if (x2 > -20 && x2 < 110) {
          elements.push(
            <rect
              key={`b${i}`}
              x={x2}
              y={y}
              width={chunk.width}
              height={LAYOUT.laneHeight}
              fill={color}
            />,
          );
        }
      });

      return elements;
    };

    // Render a small checkered flag next to the winning car during victory
    const renderCheckeredFlag = (x: number, y: number) => {
      const squares: React.ReactNode[] = [];
      const s = 1.2; // square size in viewBox units
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
          squares.push(
            <rect
              key={`${row}-${col}`}
              x={x + col * s}
              y={y + row * s}
              width={s}
              height={s}
              fill={(row + col) % 2 === 0 ? "#FFFFFF" : "#000000"}
            />,
          );
        }
      }
      return squares;
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
          aria-label="Animated F1 race"
        >
          <title>F1 Race</title>

          {lanes.map((lane) => (
            <g key={lane.id}>
              {/* Asphalt track surface */}
              {renderTrackChunks(lane.chunks, lane.y + 9)}

              {/* F1 car */}
              {renderCar(
                LAYOUT.carBaseX + state.carPositions[lane.id]!,
                lane.y,
                lane.color,
                getCarFrame(lane.id),
              )}

              {/* Checkered flag for winner during victory phase */}
              {state.phase === "victory" &&
                lane.id === state.winnerId &&
                renderCheckeredFlag(
                  LAYOUT.carBaseX +
                    state.carPositions[lane.id]! +
                    (22 * LAYOUT.carScale) / aspectRatio,
                  lane.y + 1,
                )}
            </g>
          ))}
        </svg>
      </div>
    );
  },
);
F1RaceBanner.displayName = "F1RaceBanner";
