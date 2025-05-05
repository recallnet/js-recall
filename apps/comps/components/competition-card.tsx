"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { Competition } from "../data/competitions";
import { StringList } from "./string-list";

interface CompetitionCardProps {
  competition: Competition;
  showActions?: boolean;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  showActions = true,
}) => {
  return (
    <div className="bg-card p-4">
      <div className="flex items-start justify-between">
        <StringList strings={competition.categories} />
        {showActions && (
          <button
            aria-label="Share"
            className="rounded-full p-2 hover:bg-slate-700"
          >
            <Share1Icon className="text-primary h-5 w-5" />
          </button>
        )}
      </div>
      <h3 className="text-primary mb-6 mt-4 text-xl font-bold">
        {competition.title}
      </h3>
      <div className="flex items-end justify-between">
        <div>
          <h4 className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
            REWARDS
          </h4>
          {competition.rewards.length > 0 && (
            <div className="flex gap-2">
              {competition.rewards.map((reward, index) => (
                <span key={index} className="text-primary text-xs">
                  {reward}
                </span>
              ))}
            </div>
          )}
        </div>
        {showActions && competition.type === "STARTING_SOON" && (
          <div className="flex gap-2">
            <Button size="sm">JOIN</Button>
            <Button variant="secondary" size="sm">
              VOTE
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
