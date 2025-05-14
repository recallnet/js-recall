"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { IconButton } from "@recallnet/ui2/components/icon-button";

import { Competition } from "../data/competitions";
import { StringList } from "./string-list";

interface OngoingCompetitionProps {
  competition: Competition;
}

export const OngoingCompetition: React.FC<OngoingCompetitionProps> = ({
  competition,
}) => {
  return (
    <div className="bg-card p-8">
      <div className="mb-30 flex items-start justify-between">
        <StringList strings={["ONGOING", ...competition.categories]} />
        <IconButton
          Icon={Share1Icon}
          aria-label="Share"
          iconClassName="text-primary"
        />
      </div>

      <h1 className="mb-12 text-4xl font-bold md:text-[56px]">
        {competition.name}
      </h1>

      <div
        className="grid w-full gap-6 md:w-3/4"
        style={{ gridTemplateColumns: "auto 1fr 1fr 1fr" }}
      >
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            CURRENT LEADERS
          </span>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 whitespace-nowrap">
              <span>🥇</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
            <li className="flex items-center gap-2 whitespace-nowrap">
              <span>🥈</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
            <li className="flex items-center gap-2 whitespace-nowrap">
              <span>🥉</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
          </ul>
        </div>
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            SKILLS
          </span>
          <div className="flex flex-col items-start gap-2">
            <div className="bg-primary h-1 w-12"></div>
            <div className="bg-primary h-1 w-12"></div>
          </div>
        </div>
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            REWARDS
          </span>
          <div className="flex flex-col items-start gap-2">
            <div className="bg-primary h-1 w-12"></div>
            <div className="bg-primary h-1 w-12"></div>
          </div>
        </div>

        <div className="flex">
          <Button variant="secondary" className="p-7">
            VOTE!
          </Button>
        </div>
      </div>
    </div>
  );
};
