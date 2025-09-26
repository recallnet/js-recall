"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { Competition, CompetitionStatus } from "@/types";

import { JoinCompetitionButton } from "./join-competition-button";

interface VoteButtonProps {
  competitionId: string;
  votingEnabled: boolean;
  className?: string;
}

const VoteButton: React.FC<VoteButtonProps> = ({
  competitionId,
  votingEnabled,
  className,
}) => {
  if (votingEnabled) {
    return (
      <Link href={`/competitions/${competitionId}`} className="w-full">
        <Button
          variant="outline"
          size="lg"
          className={cn("w-full uppercase", className)}
        >
          Boost
        </Button>
      </Link>
    );
  }

  return (
    <Button
      variant="outline"
      size="lg"
      className={cn("w-full uppercase", className)}
      disabled
    >
      Boost
    </Button>
  );
};

export interface CompetitionActionsProps {
  competition: Competition;
  /** Optional container classes */
  className?: string;
}

/**
 * Centralised component that renders the Boost / Join / See Results buttons for a competition
 * according to the current status. This prevents duplicated conditional logic across views.
 */
export const CompetitionActions: React.FC<CompetitionActionsProps> = ({
  competition,
  className,
}) => {
  const containerClasses = cn("flex gap-4", className);

  if (competition.status === CompetitionStatus.Pending) {
    return (
      <div className={containerClasses}>
        <VoteButton
          competitionId={competition.id}
          votingEnabled={competition.votingEnabled}
        />
        <JoinCompetitionButton
          competitionId={competition.id}
          size="lg"
          className="w-full uppercase"
        >
          Join
        </JoinCompetitionButton>
      </div>
    );
  }

  if (competition.status === CompetitionStatus.Active) {
    return (
      <div className={containerClasses}>
        <VoteButton
          competitionId={competition.id}
          votingEnabled={competition.votingEnabled}
        />
      </div>
    );
  }

  if (competition.status === CompetitionStatus.Ended) {
    return (
      <div className={containerClasses}>
        <Link href={`/competitions/${competition.id}`} className="">
          <Button variant="outline" size="lg" className="w-full uppercase">
            See Results
          </Button>
        </Link>
      </div>
    );
  }

  // For Active competitions (or any other status), we currently show nothing.
  return null;
};
