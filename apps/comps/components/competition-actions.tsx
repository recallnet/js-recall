"use client";

import Link from "next/link";
import React, { useMemo } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { openForBoosting } from "@/lib/open-for-boosting";
import { CompetitionStatus, CompetitionWithUserAgents } from "@/types";

import { JoinCompetitionButton } from "./join-competition-button";

interface BoostButtonProps {
  competitionId: string;
  votingEnabled: boolean;
  className?: string;
}

const BoostButton: React.FC<BoostButtonProps> = ({
  competitionId,
  votingEnabled,
  className,
}) => {
  const buttonStyles =
    "border border-blue-500 bg-blue-500 uppercase text-white hover:border-white hover:bg-white hover:text-blue-500 disabled:hover:bg-blue-500 disabled:hover:text-white";

  if (votingEnabled) {
    return (
      <Link href={`/competitions/${competitionId}`} className={className}>
        <Button
          variant="default"
          size="lg"
          className={cn(buttonStyles, className)}
        >
          <span className="font-semibold">Boost</span>
        </Button>
      </Link>
    );
  }

  return (
    <Button variant="default" size="lg" className={cn(buttonStyles, className)}>
      <span className="font-semibold">Boost</span>
    </Button>
  );
};

export interface CompetitionActionsProps {
  competition: CompetitionWithUserAgents;
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

  const isOpenForBoosting = useMemo(
    () => openForBoosting(competition),
    [competition],
  );

  if (competition.status === CompetitionStatus.Pending) {
    return (
      <div className={containerClasses}>
        <div className="flex-1">
          <BoostButton
            competitionId={competition.id}
            votingEnabled={isOpenForBoosting}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <JoinCompetitionButton
            competitionId={competition.id}
            className="border-blue-white w-full border border-white bg-white text-blue-500 hover:border-blue-500 hover:bg-blue-500 hover:text-white disabled:hover:bg-white disabled:hover:text-blue-500"
            disabled={competition.status !== "pending"}
            size="lg"
          >
            Join
          </JoinCompetitionButton>
        </div>
      </div>
    );
  }

  if (competition.status === CompetitionStatus.Active) {
    return (
      <div className={containerClasses}>
        <BoostButton
          competitionId={competition.id}
          votingEnabled={isOpenForBoosting}
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
