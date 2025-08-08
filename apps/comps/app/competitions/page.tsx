"use client";

import Image from "next/image";
import React, {useEffect} from "react";

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

export default function CompetitionsPage() {
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
      <div className="w-full h-100 absolute left-1/2 transform -translate-x-1/2 relative ">

        <div className="flex items-center justify-center w-full h-full">

          {
            <RainbowStripes className="w-180 absolute left-0 translate-x-[-400px]" />
          }

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

          {
            <RainbowStripes className="w-180 absolute right-0 translate-x-[400px]" direction='left' />
          }

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
          `absolute w-full top-0 bottom-0 z-10`,
          `bg-gradient-to-${direction === 'right' ? 'r' : 'l'} from-black from-10% to-transparent`,
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
          />
        ))}
      </div>
    </div>
  );
};
