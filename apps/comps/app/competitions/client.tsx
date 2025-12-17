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
          {/* Full-width snow layer - behind text */}
          <SnowOverlay className="absolute inset-0 z-10 hidden sm:block" />

          <StringLights
            side="left"
            className="absolute left-0 z-[15] hidden h-72 w-[40%] translate-x-[-20%] sm:block md:translate-x-[0%]"
          />

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

          <StringLights
            side="right"
            className="absolute right-0 z-[15] hidden h-72 w-[40%] translate-x-[20%] sm:block md:translate-x-[0%]"
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

/**
 * Full-width snow overlay - falls consistently across entire hero area
 * Memoized to prevent unnecessary re-renders
 */
const SnowOverlay: React.FC<{ className?: string }> = React.memo(
  ({ className = "" }) => {
    // Track container aspect ratio to compensate for viewBox stretch
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [aspectRatio, setAspectRatio] = React.useState(3); // Default for wide screens

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateAspectRatio = () => {
        const { width, height } = container.getBoundingClientRect();
        if (height > 0) {
          setAspectRatio(width / height);
        }
      };

      updateAspectRatio();
      const observer = new ResizeObserver(updateAspectRatio);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Respect user's motion preferences for accessibility
    const prefersReducedMotion =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    const snowflakes = React.useMemo(() => {
      const flakes = [];
      // More flakes for full-width coverage
      for (let i = 0; i < 40; i++) {
        const seed = (i * 7919 + 31337) % 100000;
        flakes.push({
          x: 2 + (seed % 96), // Full width coverage
          startY: -3 - (seed % 12),
          size: 0.25 + (seed % 4) * 0.12,
          duration: 16 + (seed % 10),
          delay: (seed % 160) / 10,
          opacity: 0.08 + (seed % 4) * 0.04,
        });
      }
      return flakes;
    }, []);

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
        >
          {snowflakes.map((flake, i) => {
            const sizeW = flake.size;
            const sizeH = flake.size * aspectRatio;
            return (
              <rect
                key={`snow-full-${i}`}
                x={flake.x - sizeW}
                y={prefersReducedMotion ? 50 : flake.startY - sizeH}
                width={sizeW * 2}
                height={sizeH * 2}
                rx={sizeW * 0.2}
                fill="#E9EDF1"
                opacity={flake.opacity}
              >
                {!prefersReducedMotion && (
                  <animate
                    attributeName="y"
                    from={flake.startY - sizeH}
                    to="105"
                    dur={`${flake.duration}s`}
                    begin={`${flake.delay}s`}
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            );
          })}
        </svg>
      </div>
    );
  },
);
SnowOverlay.displayName = "SnowOverlay";

interface StringLightsProps {
  side: "left" | "right";
  className?: string;
}

/**
 * Premium festive string lights - professionally designed
 * Intentional color flow, natural catenary curves, visual hierarchy
 * Memoized to prevent unnecessary re-renders
 */
const StringLights: React.FC<StringLightsProps> = React.memo(
  ({ side, className = "" }) => {
    // Track container aspect ratio to compensate for viewBox stretch
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [aspectRatio, setAspectRatio] = React.useState(2.5); // Default assumption

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateAspectRatio = () => {
        const { width, height } = container.getBoundingClientRect();
        if (height > 0) {
          setAspectRatio(width / height);
        }
      };

      updateAspectRatio();
      const observer = new ResizeObserver(updateAspectRatio);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Official brand colors - hex values from brand guidelines
    const brandColors = [
      { main: "#E5342A", glow: "#FF5A50" }, // Red (warm)
      { main: "#F9B700", glow: "#FFCF40" }, // Yellow (warm)
      { main: "#38A430", glow: "#5BC450" }, // Green (cool)
      { main: "#0064C7", glow: "#3090E8" }, // Blue (cool)
    ];

    // Generate strands with natural hanging catenary curves
    const strings = React.useMemo(() => {
      // Intentional color sequences - warm colors outside, cool toward center
      // This creates visual flow that guides the eye inward
      const colorSequences = {
        top: [0, 1, 0, 2, 1, 3, 2, 3], // R Y R G Y B G B - warm to cool
        bottom: [1, 0, 2, 1, 3, 2, 3], // Y R G Y B G B - offset pattern
      };

      type BulbVariation = { size: number; isCircle: boolean };
      const result: {
        lights: {
          x: number;
          y: number;
          colorIndex: number;
          intensity: number;
          delay: number;
          bulb: BulbVariation;
        }[];
        config: {
          key: string;
          lights: number;
          startY: number;
          endY: number;
          depth: number;
        };
      }[] = [];

      // Two strands: top frames title, bottom frames buttons
      const configs = [
        { key: "top", lights: 8, startY: 8, endY: 20, depth: 25 },
        { key: "bottom", lights: 7, startY: 55, endY: 68, depth: 20 },
      ];

      // Size and shape variations - mix of circles and squares like reference
      const bulbVariations = [
        { size: 1.0, isCircle: false }, // Square
        { size: 0.95, isCircle: true }, // Circle
        { size: 0.9, isCircle: false }, // Square
        { size: 1.0, isCircle: true }, // Circle
        { size: 0.85, isCircle: false }, // Square
        { size: 1.05, isCircle: true }, // Circle
        { size: 0.9, isCircle: false }, // Square
        { size: 1.0, isCircle: true }, // Circle
      ];

      configs.forEach((cfg) => {
        const lights: (typeof result)[0]["lights"] = [];
        const seq = colorSequences[cfg.key as keyof typeof colorSequences];

        for (let i = 0; i < cfg.lights; i++) {
          const t = i / (cfg.lights - 1);

          // X position: 5% to 85% to leave breathing room
          const x = 5 + t * 80;

          // CORRECTED catenary: maximum sag at CENTER, least at edges
          // Natural hanging curve - gravity pulls center down most
          const normalizedX = (t - 0.5) * 2; // -1 to 1
          const parabolicSag = 1 - normalizedX * normalizedX; // 1 at center, 0 at edges
          const sagAmount = cfg.depth * parabolicSag;

          // Base line connects the anchor points
          const baseY = cfg.startY + t * (cfg.endY - cfg.startY);
          const y = baseY + sagAmount;

          // Vary intensity - brighter toward the sag point (center of strand)
          const centeredness = 1 - Math.abs(t - 0.5) * 2;
          const intensity = 0.7 + centeredness * 0.3;

          // Get bulb variation (size, roundness, aspect)
          const bulb = bulbVariations[i % bulbVariations.length]!;
          const colorIndex = seq[i % seq.length]!;

          lights.push({
            x: side === "left" ? x : 100 - x,
            y,
            colorIndex,
            intensity,
            delay: i * 0.3,
            bulb,
          });
        }
        result.push({ lights, config: cfg });
      });
      return result;
    }, [side]);

    // Snow is now handled by the separate SnowOverlay component for full-width coverage

    // Generate smooth bezier path for wire
    const getWirePath = (strand: (typeof strings)[0]) => {
      const pts = strand.lights;
      if (pts.length < 2) return "";

      const first = pts[0]!;
      let d = `M ${first.x},${first.y}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]!;
        const curr = pts[i]!;
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        d += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
      }
      const last = pts[pts.length - 1]!;
      d += ` L ${last.x},${last.y}`;
      return d;
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
        >
          <defs>
            {/* Simple soft glow filter */}
            <filter
              id={`glow-${side}`}
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="1.5"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Wire strings - thicker branded gray line like reference */}
          {strings.map((strand, si) => (
            <path
              key={`wire-${si}`}
              d={getWirePath(strand)}
              fill="none"
              stroke="#596E89"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
          ))}

          {/* Light bulbs - mix of circles and squares, simplified glow for performance */}
          {strings.map((strand, si) =>
            strand.lights.map((light, li) => {
              const color = brandColors[light.colorIndex]!;
              const { size, isCircle } = light.bulb;
              const baseSize = 2.0;
              const bulbSize = baseSize * size;
              // Dynamic aspect ratio compensation - makes shapes appear square regardless of container
              const heightMultiplier = aspectRatio;

              if (isCircle) {
                // Circle (ellipse for aspect ratio compensation)
                const rx = bulbSize;
                const ry = bulbSize * heightMultiplier;

                return (
                  <g key={`light-${si}-${li}`}>
                    {/* Glow */}
                    <ellipse
                      cx={light.x}
                      cy={light.y}
                      rx={rx * 1.4}
                      ry={ry * 1.4}
                      fill={color.glow}
                      opacity="0.25"
                      filter={`url(#glow-${side})`}
                    />
                    {/* Core bulb */}
                    <ellipse
                      cx={light.x}
                      cy={light.y}
                      rx={rx}
                      ry={ry}
                      fill={color.main}
                    />
                    {/* Highlight */}
                    <ellipse
                      cx={light.x}
                      cy={light.y - ry * 0.4}
                      rx={rx * 0.4}
                      ry={ry * 0.15}
                      fill="white"
                      opacity="0.35"
                    />
                  </g>
                );
              } else {
                // Rounded square
                const sizeW = bulbSize;
                const sizeH = bulbSize * heightMultiplier;
                const radius = Math.min(sizeW, sizeH / heightMultiplier) * 0.15;

                return (
                  <g key={`light-${si}-${li}`}>
                    {/* Glow */}
                    <rect
                      x={light.x - sizeW * 1.4}
                      y={light.y - sizeH * 1.4}
                      width={sizeW * 2.8}
                      height={sizeH * 2.8}
                      rx={radius * 1.5}
                      fill={color.glow}
                      opacity="0.25"
                      filter={`url(#glow-${side})`}
                    />
                    {/* Core bulb */}
                    <rect
                      x={light.x - sizeW}
                      y={light.y - sizeH}
                      width={sizeW * 2}
                      height={sizeH * 2}
                      rx={radius}
                      fill={color.main}
                    />
                    {/* Highlight bar */}
                    <rect
                      x={light.x - sizeW * 0.5}
                      y={light.y - sizeH * 0.55}
                      width={sizeW}
                      height={sizeH * 0.2}
                      rx={radius * 0.5}
                      fill="white"
                      opacity="0.35"
                    />
                  </g>
                );
              }
            }),
          )}
        </svg>
      </div>
    );
  },
);
StringLights.displayName = "StringLights";
