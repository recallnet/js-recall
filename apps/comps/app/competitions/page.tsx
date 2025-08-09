"use client";

import React, {useEffect, useCallback, useState} from "react";
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll';
import {cn} from "@recallnet/ui2/lib/utils";

import {CompetitionsCollapsible} from "@/components/competitions-collapsible";
import CompetitionsSkeleton from "@/components/competitions-skeleton";
import {FeaturedCompetition} from "@/components/featured-competition";
import {FooterSection} from "@/components/footer-section";
import {JoinSwarmSection} from "@/components/join-swarm-section";
import {getSocialLinksArray} from "@/data/social";
import {useCompetitions, useUserCompetitions} from "@/hooks/useCompetitions";
import {useAnalytics} from "@/hooks/usePostHog";
import {CompetitionStatus} from "@/types";
import {mergeCompetitionsWithUserData} from "@/utils/competition-utils";
import {Button} from "@/../../packages/ui2/src/components/button";

function getTimeUntilDate(targetDate: string | Date): string {
  const now = new Date();
  const target = new Date(targetDate);

  // Reset time to start of day for accurate comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffInMs = targetDay.getTime() - today.getTime();
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  // If it's today
  if (diffInDays === 0) {
    return "today";
  }

  // If it's in the past
  if (diffInDays < 0) {
    const pastDays = Math.abs(diffInDays);
    if (pastDays === 1) return "yesterday";
    if (pastDays < 7) return `${pastDays} days ago`;
    if (pastDays < 30) {
      const weeks = Math.floor(pastDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    const months = Math.floor(pastDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  // Future dates
  if (diffInDays === 1) {
    return "tomorrow";
  }

  if (diffInDays < 7) {
    return `in ${diffInDays} days`;
  }

  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  const months = Math.floor(diffInDays / 30);
  return `in ${months} month${months > 1 ? 's' : ''}`;
}

export default function CompetitionsPage() {
  const [emblaRef] = useEmblaCarousel()
  const {trackEvent} = useAnalytics();

  // Track landing page view
  useEffect(() => {
    trackEvent("LandingPageViewed");
  }, [trackEvent]);

  const {data: activeCompetitions, isLoading: isLoadingActiveCompetitions} =
    useCompetitions({
      status: CompetitionStatus.Active,
    });

  const {
    data: upcomingCompetitions,
    isLoading: isLoadingUpcomingCompetitions,
  } = useCompetitions({
    status: CompetitionStatus.Pending,
  });

  const {data: endedCompetitions, isLoading: isLoadingEndedCompetitions} =
    useCompetitions({
      status: CompetitionStatus.Ended,
    });

  const {data: userCompetitions, isLoading: isLoadingUserCompetitions} =
    useUserCompetitions();

  const carouselContent = React.useMemo(() => {
    const compCarousel = upcomingCompetitions?.competitions
      .filter(comp => !!comp.startDate)
      .map((comp, i) => (
        <span key={i} className='text-black'>
          {comp.name} starts in <span className="font-bold">{getTimeUntilDate(new Date(comp?.startDate as string))}</span>
        </span>
      )) || []
    const votesCarousel = upcomingCompetitions?.competitions
      .filter(comp => !!comp.stats?.totalVotes)
      .map((comp, i) => (
        <span key={i} className='text-black'>
          {comp.name} received <span className="font-bold">{comp.stats.totalVotes} total votes</span>
        </span>
      )) || []
    const carouselContent = compCarousel.concat(votesCarousel).concat([
      <span key='custom'>
        Placeholder content <span className="font-bold">1000</span>
      </span>
    ])

    return carouselContent
  }, [upcomingCompetitions?.competitions])

  if (
    isLoadingActiveCompetitions ||
    isLoadingUpcomingCompetitions ||
    isLoadingEndedCompetitions ||
    isLoadingUserCompetitions
  ) {
    return <CompetitionsSkeleton />;
  }

  return (
    <div >
      <div className="w-full h-120 absolute left-1/2 transform -translate-x-1/2 relative pt-40">

        {
          carouselContent.length > 0 &&
          <HeroCarousel className="absolute top-0 left-[-200px] right-[-200px]" texts={carouselContent} />
        }

        <div className="flex items-center justify-center w-full h-full">

          <RainbowStripes className="w-200 absolute left-0 translate-x-[-500px]" />

          <div className="flex flex-col items-center text-center translate-y-[-50px]">
            <h1 className="text-[83px] font-bold text-primary-foreground mb-1">
              Enter the Arena
            </h1>
            <p className="text-sm text-primary-foreground mb-8">
              Stake tokens, back the smartest trading bots and earn rewards.
            </p>

            <div className="flex gap-1">
              <Button className="p-6 bg-white text-black border border-white hover:bg-black hover:text-white transition-colors duration-200">
                BROWSE COMPETITIONS
              </Button>
              <Button className="p-6 bg-black text-white border border-white hover:bg-white hover:text-black transition-colors duration-200">
                JOIN
              </Button>
            </div>
          </div>

          <RainbowStripes className="w-200 absolute right-0 translate-x-[500px]" direction='left' />

        </div>
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


interface HeroCarouselProps {
  texts: React.ReactNode[];
  className?: string;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  texts,
  className = ''
}) => {
  const [emblaRef, _] = useEmblaCarousel({
    loop: true,
  }, [
    AutoScroll({
      playOnInit: true,
      speed: 1,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  ]);

  // at least 8 elements. The carousel must be filled to work
  const multiplyContent = Math.floor(8 / texts.length) + Number(8 % texts.length != 0)
  const content = Array.from({length: multiplyContent}, () => [...texts]).flat();
  const renderComponent = (component: React.ReactNode, index: number) => (
    <div key={index} className="text-gray-800 text-lg text-nowrap uppercase">
      {component}
    </div>
  );
  const sparkle = (
    <svg width="15" height="15" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.60786 0.213545C3.61749 0.00164161 3.96617 -0.0831173 4.0702 0.101817C4.5595 0.968696 5.39171 2.24204 6.33564 2.82189C7.27958 3.39981 8.79373 3.56548 9.78775 3.60786C9.99965 3.61749 10.0825 3.96617 9.89755 4.0702C9.03067 4.5595 7.75925 5.39171 7.1794 6.33564C6.59956 7.27958 6.43581 8.79373 6.39343 9.78775C6.3838 9.99965 6.0332 10.0825 5.9311 9.89755C5.44179 9.03067 4.60959 7.75925 3.66373 7.17941C2.71979 6.59956 1.20564 6.43581 0.213548 6.39343C0.0016441 6.3838 -0.0831185 6.0332 0.101816 5.9311C0.968695 5.44179 2.24205 4.60959 2.82189 3.66373C3.39981 2.71979 3.56548 1.20564 3.60786 0.213545Z" fill="#11121A" />
    </svg>
  )


  return (
    <div className={`bg-white py-4 ${className}`}>
      <div className={cn(
        `absolute w-full top-0 bottom-0 z-10`,
        `bg-gradient-to-r from-black via-transparent to-black`,
      )}></div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-10">
          {content.map((component, index) => (
            <div key={index} className="flex gap-10 items-center">
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
  direction?: 'left' | 'right';
  width?: string;
  height?: string;
  className?: string;
}

export const RainbowStripes: React.FC<RainbowStripesProps> = ({
  direction = 'right',
  className = ''
}) => {
  const colors = [
    '#FF0000', // Red
    '#FFA500', // Orange/Yellow
    '#00FF00', // Green
    '#0000FF', // Blue
    '#000000'  // Black
  ];

  // Create the clip-path for the triangular spike
  const clipPath = direction === 'right'
    ? 'polygon(0 0, calc(100% - 140px) 0, 100% 80%, 100% 100%, 0 100%)'
    : 'polygon(calc(0% + 140px) 0, 100% 0, 100% 100%, 0% 100%, 0% 80% )';

  return (
    <div
      className={className}
    >
      <div
        className="relative h-60"
      >
        <div className={cn(
          `absolute w-full top-0 bottom-[-100px] z-10`,
          direction === 'right' ? 'bg-gradient-to-r' : 'bg-gradient-to-l',
          'from-black from-10% to-transparent'
        )}></div>
        {colors.map((color, index) => (
          <div
            key={index}
            className={cn(`absolute w-full h-45`)}
            style={{
              backgroundColor: color,
              clipPath: clipPath,
              top: `calc(38px * ${index})`,
              transform: `translateX(${index * 30 * (direction === 'right' ? 1 : -1)}px)`
            }}
          >
            {index != colors.length - 1 &&
              <div
                className={cn(
                  "h-full w-full z-20 absolute",
                  "bg-[length:250%_250%,100%_100%] bg-no-repeat",
                  direction === 'right' ?
                    `bg-[linear-gradient(60deg,transparent_47%,rgba(255,255,255)_50%,transparent_52%,transparent_100%)]`
                    :
                    `bg-[linear-gradient(120deg,transparent_47%,rgba(255,255,255)_50%,transparent_52%,transparent_100%)]`
                )}
                style={{
                  animation: "shine 6s ease-in-out infinite",
                  animationDirection: direction === 'right' ? "reverse" : 'normal',
                  // right and left dirs hit on different times
                  // a small time variation depending on the index
                  animationDelay: direction === 'right' ? `${1.9 + Math.random() * 0.2}s` : `${Math.random() * 0.2}s`
                }}
              />
            }
          </div>
        ))}
      </div>
    </div>
  );
};
