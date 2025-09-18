import { Competition, CompetitionStatus } from "@/types";

type VotingStatusConfig = {
  subTitle: string;
  description: string;
  variant: "green" | "blue" | "gray";
  untilTime: Date | null;
  phase: string | null;
};

/**
 * Determines the configuration for the competition state banner.
 * This function handles various states including registration capacity limits.
 * When a competition reaches its maxParticipants limit, it will show
 * "Registration is full" regardless of the time window remaining.
 */
export function getCompetitionStateConfig(
  competition: Competition,
  hasVoted: boolean,
): VotingStatusConfig {
  const status = competition.status;
  const compStartDate = competition.startDate
    ? new Date(competition.startDate)
    : null;
  const compEndDate = competition.endDate
    ? new Date(competition.endDate)
    : null;
  const votingStart = competition.votingStartDate
    ? new Date(competition.votingStartDate)
    : null;
  const votingEnd = competition.votingEndDate
    ? new Date(competition.votingEndDate)
    : null;
  const joinStart = competition.joinStartDate
    ? new Date(competition.joinStartDate)
    : null;
  const joinEnd = competition.joinEndDate
    ? new Date(competition.joinEndDate)
    : null;
  const now = new Date();

  if (hasVoted) {
    if (status === CompetitionStatus.Pending) {
      return {
        subTitle: "Counting votes!",
        description: compStartDate ? "Competition starts in..." : "",
        variant: "gray",
        untilTime: compStartDate,
        phase: null,
      };
    }
    if (status === CompetitionStatus.Active) {
      return {
        subTitle: "Counting votes!",
        description: compEndDate ? "Competition ends in..." : "",
        variant: "gray",
        untilTime: compEndDate,
        phase: null,
      };
    }
    if (status === CompetitionStatus.Ended) {
      // NOTE: we should never get here since the banner is hidden if the
      //  comp is ended.
      return {
        subTitle: "Votes are counted!",
        description: "Competition ended and the votes are counted...",
        variant: "gray",
        untilTime: null,
        phase: null,
      };
    }
    // Should never get here
    return {
      subTitle: "Voting not available",
      description: "",
      variant: "gray",
      untilTime: null,
      phase: null,
    };
  }

  // all states below here are for competitions that the user has not voted on yet

  // Flow #1
  if (
    compStartDate === null &&
    compEndDate === null &&
    joinStart === null &&
    joinEnd === null &&
    votingStart === null &&
    votingEnd === null
  ) {
    return {
      subTitle: "Registration starting soon!",
      description: "",
      variant: "green",
      untilTime: null,
      phase: null,
    };
  }

  // Flow #2
  if (joinStart && now < joinStart) {
    return {
      subTitle: "Get ready!",
      description: "Registration opens in...",
      variant: "green",
      untilTime: joinStart,
      phase: "registration",
    };
  }

  // Flow #3
  if (joinStart && joinEnd === null && now >= joinStart) {
    // Check if registration is full (max participants reached)
    if (
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants
    ) {
      return {
        subTitle: "Registration is closed",
        description: "Maximum participants reached",
        variant: "gray",
        untilTime: null,
        phase: null,
      };
    }
    return {
      subTitle: "Registration is open!",
      description: "",
      variant: "green",
      untilTime: null,
      phase: "registration",
    };
  }

  // Flow #4
  if (joinEnd && now < joinEnd) {
    // Check if registration is full (max participants reached)
    if (
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants
    ) {
      return {
        subTitle: "Registration is closed",
        description: "Maximum participants reached",
        variant: "gray",
        untilTime: null,
        phase: null,
      };
    }
    return {
      subTitle: "Join now!",
      description: "Registration closes in...",
      variant: "green",
      untilTime: joinEnd,
      phase: "registration",
    };
  }

  // Flow #5
  if (joinEnd && now >= joinEnd && votingStart === null) {
    return {
      subTitle: "Registration is closed",
      description: "",
      variant: "gray",
      untilTime: null,
      phase: null,
    };
  }

  // Flow #6
  if (votingStart && now < votingStart) {
    return {
      subTitle: "Get ready!",
      description: "Voting opens in...",
      variant: "blue",
      untilTime: votingStart,
      phase: "voting",
    };
  }

  // Flow #7
  if (votingStart && votingEnd === null && now >= votingStart) {
    return {
      subTitle: "Voting is closed!",
      description: "",
      variant: "gray",
      untilTime: null,
      phase: null,
    };
  }

  // Flow #8
  if (votingEnd && now < votingEnd) {
    return {
      subTitle: "Get ready!",
      description: "Voting closes in...",
      variant: "blue",
      untilTime: votingEnd,
      phase: "voting",
    };
  }

  // Flow #9
  if (votingEnd && now >= votingEnd) {
    if (status === CompetitionStatus.Pending) {
      return {
        subTitle: "Voting is closed!",
        description: compStartDate ? "Competition starts in..." : "",
        variant: "gray",
        untilTime: compStartDate,
        phase: null,
      };
    }
    if (status === CompetitionStatus.Active) {
      return {
        subTitle: "Voting is closed!",
        description: compEndDate ? "Competition ends in..." : "",
        variant: "gray",
        untilTime: compEndDate,
        phase: null,
      };
    }
  }

  return {
    subTitle: "Registration is closed!",
    description: ``,
    variant: "gray",
    untilTime: null,
    phase: null,
  };
}
