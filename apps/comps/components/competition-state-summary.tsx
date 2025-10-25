import { formatDistanceToNow, isFuture } from "date-fns";
import { Circle } from "lucide-react";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { RouterOutputs } from "@/rpc/router";
import { CompetitionWithUserAgents } from "@/types";

import CountdownClock from "./clock";

type CompetitionData =
  | CompetitionWithUserAgents
  | RouterOutputs["competitions"]["getById"];

interface CompetitionStateSummaryProps {
  competition: CompetitionData;
  className?: string;
}

// Type guard to check if competition has agents array
const hasAgents = (
  comp: CompetitionData,
): comp is CompetitionWithUserAgents => {
  return "agents" in comp;
};

/**
 * Displays the current state of a competition including registration and boosting status.
 * Shows registration window status (open/closed/full) and boosting window status
 * with appropriate visual indicators and countdown timers.
 *
 * Handles multiple states:
 * - Registration not started, open, closing soon, closed, or full
 * - Boosting not started, open, closing soon, or closed
 * - Special handling for competitions with no dates set
 */
export const CompetitionStateSummary: React.FC<
  CompetitionStateSummaryProps
> = ({ competition, className }) => {
  const now = new Date();
  const joinStartDate = competition.joinStartDate
    ? new Date(competition.joinStartDate)
    : null;
  const joinEndDate = competition.joinEndDate
    ? new Date(competition.joinEndDate)
    : null;
  const boostStartDate = competition.boostStartDate
    ? new Date(competition.boostStartDate)
    : null;
  const boostEndDate = competition.boostEndDate
    ? new Date(competition.boostEndDate)
    : null;

  const isRegistered = hasAgents(competition) && competition.agents.length > 0;

  const getRegistrationState = () => {
    // Check if registration is full
    const isRegistrationFull =
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants;

    // 1. You are registered (grey)
    if (isRegistered) {
      return {
        text: "You are registered",
        color: "text-gray-500",
        date: null,
        showCountdown: false,
      };
    }

    // 2. Registration is full (red)
    if (isRegistrationFull) {
      return {
        text: "Registration is full",
        color: "text-red-500",
        date: null,
        showCountdown: false,
      };
    }

    // 3. Registration opens in [relative time] (blue)
    if (joinStartDate && isFuture(joinStartDate)) {
      const timeDiff = joinStartDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Registration opens in",
        color: "text-blue-600",
        date: joinStartDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // 4. Registration closes in [hh:mm:ss] (green)
    if (joinEndDate && isFuture(joinEndDate)) {
      const timeDiff = joinEndDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Registration closes in",
        color: "text-green-500",
        date: joinEndDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // 5. Registration is closed (grey)
    return {
      text: "Registration is closed",
      color: "text-gray-500",
      date: null,
      showCountdown: false,
    };
  };

  const getBoostingState = () => {
    // Boosting period hasn't started (grey)
    if (boostStartDate && isFuture(boostStartDate)) {
      const timeDiff = boostStartDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Boosting starts in",
        color: "text-gray-500",
        date: boostStartDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // Boosting closes in [hh:mm:ss] (green)
    if (boostEndDate && isFuture(boostEndDate)) {
      const timeDiff = boostEndDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Boosting closes in",
        color: "text-green-500",
        date: boostEndDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // Boosting is closed (grey)
    return {
      text: "Boosting is closed",
      color: "text-gray-500",
      date: null,
      showCountdown: false,
    };
  };

  const registrationState = getRegistrationState();
  const boostingState = getBoostingState();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Main status row - Stacks on mobile, inline on desktop */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Registration State */}
        <div className="flex flex-1 items-center gap-3">
          <Circle
            className={cn("h-2 w-2 fill-current", registrationState.color)}
          />
          <div className="flex items-center gap-1">
            <span className="text-sm">{registrationState.text}</span>
            {registrationState.date &&
              (registrationState.showCountdown ? (
                <CountdownClock
                  targetDate={registrationState.date}
                  className="text-sm font-bold text-white"
                />
              ) : (
                <span className="text-sm font-bold text-white">
                  {formatDistanceToNow(registrationState.date)}
                </span>
              ))}
          </div>
        </div>

        {/* Boosting State */}
        <div className="flex flex-1 items-center gap-3">
          <Circle className={cn("h-2 w-2 fill-current", boostingState.color)} />
          <div className="flex items-center gap-1">
            <span className="text-sm">{boostingState.text}</span>
            {boostingState.date &&
              (boostingState.showCountdown ? (
                <CountdownClock
                  targetDate={boostingState.date}
                  className="text-sm font-bold text-white"
                />
              ) : (
                <span className="text-sm font-bold text-white">
                  {formatDistanceToNow(boostingState.date)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionStateSummary;
