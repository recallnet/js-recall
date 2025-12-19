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
          {/* Fireworks launching and exploding - mid layer */}
          <Fireworks className="absolute inset-0 z-[8] hidden sm:block" />

          {/* Minimal cityscape silhouette - foreground */}
          <Cityscape className="absolute inset-x-0 bottom-0 z-[10] hidden h-[40%] sm:block" />

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

// Brand colors used across NYE components
const brandColors = ["#E5342A", "#F9B700", "#38A430", "#0064C7"]; // Red, Yellow, Green, Blue

/**
 * Minimal cityscape silhouette - two-tone bar chart style
 * Clean geometric rectangles, subtle depth
 */
const Cityscape: React.FC<{ className?: string }> = React.memo(
  ({ className = "" }) => {
    const buildings = React.useMemo(() => {
      // Seeded pseudo-random for deterministic layout
      let seed = 54321;
      const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const buildingCount = 24;
      const result: Array<{
        x: number;
        width: number;
        height: number;
        color: string;
      }> = [];
      let currentX = 0;

      for (let i = 0; i < buildingCount; i++) {
        const width = 2.5 + random() * 3; // 2.5-5.5 units wide
        const height = 15 + random() * 45; // 15-60% height
        // Two-tone: taller buildings darker, shorter lighter
        const color = height > 35 ? "#1A1D28" : "#252A36";

        result.push({ x: currentX, width, height, color });
        currentX += width + 0.3; // Small gap
      }

      // Normalize to fill width
      const totalWidth = currentX;
      result.forEach((b) => {
        b.x = (b.x / totalWidth) * 100;
        b.width = (b.width / totalWidth) * 100;
      });

      return result;
    }, []);

    return (
      <div
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
          {buildings.map((b, i) => (
            <rect
              key={`b-${i}`}
              x={b.x}
              y={100 - b.height}
              width={b.width}
              height={b.height}
              fill={b.color}
            />
          ))}
        </svg>
      </div>
    );
  },
);
Cityscape.displayName = "Cityscape";

interface FireworkState {
  id: number;
  x: number; // Launch x position (0-100)
  launchY: number; // Where it launches from (bottom of sky, around 70-85)
  burstY: number; // Where it explodes (10-40)
  colorIndex: number;
  createdAt: number;
  burstTime: number; // When it explodes (after launch travel)
  isCircleBurst: boolean; // Burst style - all circles or all squares
}

/**
 * Fireworks - launch trails shooting up, then exploding into branded particles
 */
const Fireworks: React.FC<{ className?: string }> = React.memo(
  ({ className = "" }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [aspectRatio, setAspectRatio] = React.useState(3);
    const [fireworks, setFireworks] = React.useState<FireworkState[]>([]);
    const nextId = React.useRef(0);
    const [now, setNow] = React.useState(Date.now());

    const prefersReducedMotion =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    // Track aspect ratio
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

    // Create a new firework
    const createFirework = React.useCallback((): FireworkState => {
      const timestamp = Date.now();

      return {
        id: nextId.current++,
        x: 10 + Math.random() * 80, // Launch from across the width
        launchY: 75 + Math.random() * 10, // Start from behind buildings (75-85)
        burstY: 15 + Math.random() * 25, // Explode in upper area (15-40)
        colorIndex: Math.floor(Math.random() * 4),
        createdAt: timestamp,
        burstTime: 800 + Math.random() * 400, // 0.8-1.2s to reach burst point
        isCircleBurst: Math.random() < 0.5, // Each burst is consistently all circles OR all squares
      };
    }, []);

    // Animation loop
    React.useEffect(() => {
      if (prefersReducedMotion) {
        // Show static burst particles
        setFireworks([createFirework(), createFirework(), createFirework()]);
        return;
      }

      // Initial fireworks
      setFireworks([createFirework(), createFirework()]);

      // Launch new firework every 1-2 seconds
      const launchInterval = setInterval(() => {
        setFireworks((prev) => {
          const currentTime = Date.now();
          // Keep fireworks for 3 seconds total (launch + burst + fade)
          const active = prev.filter((f) => currentTime - f.createdAt < 3000);
          if (active.length < 4) {
            return [...active, createFirework()];
          }
          return active;
        });
      }, 1200);

      // Update animation
      const frameInterval = setInterval(() => setNow(Date.now()), 50);

      return () => {
        clearInterval(launchInterval);
        clearInterval(frameInterval);
      };
    }, [createFirework, prefersReducedMotion]);

    // Generate burst particles for a firework
    const getBurstParticles = (fw: FireworkState) => {
      let seed = fw.id * 12345;
      const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const particles = [];
      const count = 14 + Math.floor(random() * 6); // 14-20 particles

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + random() * 0.3;
        particles.push({
          angle,
          distance: 3 + random() * 4, // How far they travel
          size: 0.35 + random() * 0.3, // Smaller particles (0.35-0.65)
        });
      }
      return particles;
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
            {/* Glow filter: blurred halo + crisp source merged on top */}
            <filter id="fw-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="1.2"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {fireworks.map((fw) => {
            const age = prefersReducedMotion
              ? fw.burstTime + 500
              : now - fw.createdAt;
            const isLaunching = age < fw.burstTime;
            const burstAge = age - fw.burstTime;
            const color = brandColors[fw.colorIndex]!;

            if (isLaunching && !prefersReducedMotion) {
              // Draw launch trail - tiny white/light squares going up
              const progress = age / fw.burstTime;
              const currentY = fw.launchY - (fw.launchY - fw.burstY) * progress;

              // Trail of small squares behind the rocket
              const trailSquares = [];
              for (let t = 0; t < 5; t++) {
                const trailY = currentY + t * 2;
                if (trailY < fw.launchY) {
                  const trailOpacity = 0.8 - t * 0.15;
                  const trailSize = 0.4 - t * 0.05;
                  trailSquares.push(
                    <rect
                      key={`trail-${fw.id}-${t}`}
                      x={fw.x - trailSize}
                      y={trailY - trailSize * aspectRatio}
                      width={trailSize * 2}
                      height={trailSize * 2 * aspectRatio}
                      fill="#ffffff"
                      opacity={trailOpacity}
                    />,
                  );
                }
              }

              return <g key={`fw-${fw.id}`}>{trailSquares}</g>;
            } else if (burstAge > 0 || prefersReducedMotion) {
              // Draw explosion
              const burstProgress = prefersReducedMotion
                ? 0.5
                : Math.min(burstAge / 1500, 1);
              const opacity = prefersReducedMotion
                ? 0.7
                : Math.max(0, 1 - burstProgress * 0.8);
              const expandProgress = Math.min(
                (prefersReducedMotion ? 500 : burstAge) / 600,
                1,
              );

              const particles = getBurstParticles(fw);

              return (
                <g key={`fw-${fw.id}`} opacity={opacity}>
                  {particles.map((p, idx) => {
                    const dist = p.distance * expandProgress;
                    const px = fw.x + Math.cos(p.angle) * dist;
                    const py =
                      fw.burstY + Math.sin(p.angle) * dist + burstProgress * 3;
                    const sizeW = p.size;
                    const sizeH = p.size * aspectRatio;
                    // Glow is 1.6x larger with lower opacity
                    const glowSizeW = sizeW * 1.6;
                    const glowSizeH = sizeH * 1.6;

                    if (fw.isCircleBurst) {
                      return (
                        <g key={idx}>
                          {/* Glow halo */}
                          <ellipse
                            cx={px}
                            cy={py}
                            rx={glowSizeW}
                            ry={glowSizeH}
                            fill={color}
                            opacity={0.35}
                            filter="url(#fw-glow)"
                          />
                          {/* Crisp core */}
                          <ellipse
                            cx={px}
                            cy={py}
                            rx={sizeW}
                            ry={sizeH}
                            fill={color}
                          />
                        </g>
                      );
                    } else {
                      return (
                        <g key={idx}>
                          {/* Glow halo */}
                          <rect
                            x={px - glowSizeW}
                            y={py - glowSizeH}
                            width={glowSizeW * 2}
                            height={glowSizeH * 2}
                            fill={color}
                            opacity={0.35}
                            filter="url(#fw-glow)"
                          />
                          {/* Crisp core */}
                          <rect
                            x={px - sizeW}
                            y={py - sizeH}
                            width={sizeW * 2}
                            height={sizeH * 2}
                            fill={color}
                          />
                        </g>
                      );
                    }
                  })}
                </g>
              );
            }

            return null;
          })}
        </svg>
      </div>
    );
  },
);
Fireworks.displayName = "Fireworks";
