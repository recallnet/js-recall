"use client";

import {Share1Icon} from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import {Button} from "@recallnet/ui2/components/button";
import {IconButton} from "@recallnet/ui2/components/icon-button";

import {StringList} from "@/components/string-list";
import {CompetitionResponse, CompetitionStatus} from "@/types";

interface CompetitionCardProps {
  competition: CompetitionResponse;
  showActions?: boolean;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  showActions = true,
}) => {
  return (
    <div className="bg-card p-4">
      <div className="flex items-start justify-between">
        <StringList strings={competition.type} />
        {showActions && (
          <IconButton
            Icon={Share1Icon}
            aria-label="Share"
            iconClassName="text-primary"
          />
        )}
      </div>
      <Link href={`/competitions/${competition.id}`} className="block">
        <h1 className="mb-6 mt-4 text-xl font-bold hover:underline">
          {competition.name}
        </h1>
      </Link>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
            REWARDS
          </span>
          {competition.rewards.length > 0 && (
            <div className="flex gap-2">
              {competition.rewards.map((reward, index) => (
                <span key={index} className="text-primary text-xs">
                  {reward.amount} {reward.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {showActions && competition.status === CompetitionStatus.Pending && (
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
