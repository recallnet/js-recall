"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { IconButton } from "@recallnet/ui2/components/icon-button";

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
          <IconButton
            Icon={Share1Icon}
            aria-label="Share"
            iconClassName="text-primary"
          />
        )}
      </div>
      <h1 className="mb-6 mt-4 text-xl font-bold">{competition.name}</h1>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
            REWARDS
          </span>
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
        {showActions && competition.status === "pending" && (
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
