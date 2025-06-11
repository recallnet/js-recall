"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { Competition, CompetitionStatus } from "@/types";

import { JoinCompetitionButton } from "./join-competition-button";

export interface CompetitionActionsProps {
  competition: Competition;
  /** Optional container classes */
  className?: string;
}

/**
 * Centralised component that renders the Vote / Join / See Results buttons for a competition
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
        <Button
          variant="outline"
          size="lg"
          className="w-full uppercase"
          disabled
        >
          Vote
        </Button>
        <JoinCompetitionButton
          competitionId={competition.id}
          size="lg"
          className="w-full uppercase"
          disabled
        >
          Join
        </JoinCompetitionButton>
      </div>
    );
  }

  if (competition.status === CompetitionStatus.Ended) {
    return (
      <div className={containerClasses}>
        <Link href={`/competitions/${competition.id}`}>
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
