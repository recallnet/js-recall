"use client";

import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import CountdownClock from "@/components/clock/index";
import { CompetitionResponse } from "@/types";

interface OngoingCompetitionProps {
  competition: CompetitionResponse;
}

export const LeaderboardOngoingCompetition: React.FC<
  OngoingCompetitionProps
> = ({ competition }) => {
  return (
    <div className="bg-card p-8">
      <div className="mb-12 flex flex-col items-start justify-start md:flex-row">
        <h1 className="text-primary text-4xl font-bold md:text-[40px] lg:text-[56px]">
          Competition A
        </h1>
        <h1 className="text-secondary text-4xl font-bold md:ml-10 md:text-[40px] lg:text-[56px]">
          Upcoming
        </h1>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:w-4/5 md:grid-cols-4 xl:w-3/5">
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            SKILLS TESTED
          </h2>
          <div className="flex flex-col items-start gap-2">
            <div className="bg-primary h-1 w-12"></div>
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            REWARDS
          </h2>
          <div className="flex items-start">
            <div className="bg-primary h-6 w-6 rounded-full border-2 border-black"></div>
            <div className="bg-primary h-6 w-6 -translate-x-2 rounded-full border-2 border-black"></div>
            <div className="bg-primary h-6 w-6 -translate-x-4 rounded-full border-2 border-black"></div>
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            STARTS SOON
          </h2>
          <div className="flex items-start">
            <CountdownClock targetDate={new Date(competition.startDate)} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="w-45 bg-sky-700 p-7 hover:bg-sky-600">JOIN</Button>
          <Button variant="secondary" className="w-55 p-7">
            DETAILS
          </Button>
        </div>
      </div>
    </div>
  );
};
