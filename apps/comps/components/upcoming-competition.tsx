"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { IconButton } from "@recallnet/ui2/components/icon-button";

import { Competition } from "../data/competitions";
import CountdownClock from "./clock";
import { StringList } from "./string-list";

interface UpComingCompetitionProps {
  competition: Competition;
}

export const UpComingCompetition: React.FC<UpComingCompetitionProps> = ({
  competition,
}) => {
  return (
    <div className="bg-card p-8">
      <div className="mb-30 flex items-start justify-between">
        <StringList strings={["UPCOMING", ...competition.categories]} />
        <IconButton
          Icon={Share1Icon}
          aria-label="Share"
          iconClassName="text-primary"
        />
      </div>

      <h1 className="text-primary mb-12 text-4xl font-bold md:text-[56px]">
        Competition
      </h1>

      <div
        className="grid w-full gap-6 md:w-3/4"
        style={{ gridTemplateColumns: "auto 1fr 1fr 1fr 1fr" }}
      >
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            SKILLS
          </h2>
          <div className="flex flex-col items-start gap-2">
            <div className="bg-primary h-1 w-12"></div>
            <div className="bg-primary h-1 w-12"></div>
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            REWARDS
          </h2>
          <div className="flex flex-col items-start gap-2">
            <div className="bg-primary h-1 w-12"></div>
            <div className="bg-primary h-1 w-12"></div>
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            STARTS SOON
          </h2>
          <div>
            <CountdownClock targetDate={competition.startDate} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="p-7">JOIN</Button>
          <Button variant="secondary" className="p-7">
            VOTE
          </Button>
        </div>
      </div>
    </div>
  );
};
