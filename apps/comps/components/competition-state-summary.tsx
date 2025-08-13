import { formatDistanceToNow, isFuture } from "date-fns";
import { Circle } from "lucide-react";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { UserCompetition } from "../types/competition";
import CountdownClock from "./clock";

interface CompetitionStateSummaryProps {
  competition: UserCompetition;
  className?: string;
}

/**
 * Displays the current state of a competition including registration and voting status
 * with appropriate colors and timing information.
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
  const votingStartDate = competition.votingStartDate
    ? new Date(competition.votingStartDate)
    : null;
  const votingEndDate = competition.votingEndDate
    ? new Date(competition.votingEndDate)
    : null;
  const hasVoted = competition.userVotingInfo?.info.hasVoted || false;
  const isRegistered = competition.agents && competition.agents.length > 0;

  const getRegistrationState = () => {
    // 1. You are registered (grey)
    if (isRegistered) {
      return {
        text: "You are registered",
        color: "text-gray-500",
        date: null,
        showCountdown: false,
      };
    }

    // 2. Registration opens in [relative time] (blue)
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

    // 3. Registration closes in [hh:mm:ss] (green)
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

    // 4. Registration is closed (grey)
    return {
      text: "Registration is closed",
      color: "text-gray-500",
      date: null,
      showCountdown: false,
    };
  };

  const getVotingState = () => {
    // 1. Voting is not enabled (grey)
    if (competition.votingEnabled !== undefined && !competition.votingEnabled) {
      return {
        text: "Voting is not enabled",
        color: "text-gray-500",
        date: null,
        showCountdown: false,
      };
    }

    // 2. You already voted (grey)
    if (hasVoted) {
      return {
        text: "You already voted",
        color: "text-gray-500",
        date: null,
        showCountdown: false,
      };
    }

    // 3. Voting period hasn't started (grey)
    if (votingStartDate && isFuture(votingStartDate)) {
      const timeDiff = votingStartDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Voting period starts in",
        color: "text-gray-500",
        date: votingStartDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // 4. Voting closes in [hh:mm:ss] (green)
    if (votingEndDate && isFuture(votingEndDate)) {
      const timeDiff = votingEndDate.getTime() - now.getTime();
      const isLessThan24Hours = timeDiff < 24 * 60 * 60 * 1000;

      return {
        text: "Voting closes in",
        color: "text-green-500",
        date: votingEndDate,
        showCountdown: isLessThan24Hours,
      };
    }

    // 5. Voting is closed (grey)
    return {
      text: "Voting is closed",
      color: "text-gray-500",
      date: null,
      showCountdown: false,
    };
  };

  const registrationState = getRegistrationState();
  const votingState = getVotingState();

  return (
    <div className={cn("space-y-2", className)}>
      {/* Registration State */}
      <div className="flex items-center gap-2">
        <Circle
          className={cn("h-2 w-2 fill-current", registrationState.color)}
        />
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

      {/* Voting State */}
      {
        <div className="flex items-center gap-2">
          <Circle className={cn("h-2 w-2 fill-current", votingState.color)} />
          <span className="text-sm">{votingState.text}</span>
          {votingState.date &&
            (votingState.showCountdown ? (
              <CountdownClock
                targetDate={votingState.date}
                className="text-sm font-bold text-white"
              />
            ) : (
              <span className="text-sm font-bold text-white">
                {formatDistanceToNow(votingState.date)}
              </span>
            ))}
        </div>
      }
    </div>
  );
};

export default CompetitionStateSummary;
