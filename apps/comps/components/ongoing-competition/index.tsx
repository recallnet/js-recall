"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { Competition } from "../../data/competitions";
import { StringList } from "../string-list";

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
        <button
          aria-label="Share"
          className="rounded-full p-2 hover:bg-slate-700"
        >
          <Share1Icon className="text-primary h-5 w-5" />
        </button>
      </div>

      <h1 className="text-primary mb-12 text-4xl font-bold md:text-[56px]">
        Competition
      </h1>

      <div className="grid w-full grid-cols-1 gap-6 md:w-3/4 md:grid-cols-4">
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            CURRENT LEADERS
          </h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span>🥇</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
            <li className="flex items-center gap-2">
              <span>🥈</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
            <li className="flex items-center gap-2">
              <span>🥉</span>
              <span className="text-primary text-xs">AGENT NAME</span>
            </li>
          </ul>
        </div>
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

        <div className="flex">
          <Button variant="secondary" className="p-7">
            VOTE!
          </Button>
        </div>
      </div>
    </div>
  );
};
