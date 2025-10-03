import { RouterOutputs } from "@/rpc/router";

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
  competition: RouterOutputs["competitions"]["getById"],
  hasVoted: boolean,
): VotingStatusConfig {
  const {
    status,
    startDate,
    endDate,
    votingStartDate,
    votingEndDate,
    joinStartDate,
    joinEndDate,
  } = competition;
  const now = new Date();

  if (hasVoted) {
    if (status === "pending") {
      return {
        subTitle: "Counting boosts!",
        description: startDate ? "Competition starts in..." : "",
        variant: "gray",
        untilTime: startDate,
        phase: null,
      };
    }
    if (status === "active") {
      return {
        subTitle: "Counting boosts!",
        description: endDate ? "Competition ends in..." : "",
        variant: "gray",
        untilTime: endDate,
        phase: null,
      };
    }
    if (status === "ended") {
      // NOTE: we should never get here since the banner is hidden if the
      //  comp is ended.
      return {
        subTitle: "Boosts are counted!",
        description: "Competition ended and the boosts are counted...",
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
    startDate === null &&
    endDate === null &&
    joinStartDate === null &&
    joinEndDate === null &&
    votingStartDate === null &&
    votingEndDate === null
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
  if (joinStartDate && now < joinStartDate) {
    return {
      subTitle: "Get ready!",
      description: "Registration opens in...",
      variant: "green",
      untilTime: joinStartDate,
      phase: "registration",
    };
  }

  // Flow #3
  if (joinStartDate && joinEndDate === null && now >= joinStartDate) {
    // Check if registration is at capacity
    const isRegistrationFull =
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants;

    if (isRegistrationFull) {
      return {
        subTitle: "Registration is full",
        description: `Maximum capacity reached (${competition.maxParticipants} participants)`,
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
  if (joinEndDate && now < joinEndDate) {
    // Check if registration is at capacity
    const isRegistrationFull =
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants;

    if (isRegistrationFull) {
      return {
        subTitle: "Registration is full",
        description: `Maximum capacity reached (${competition.maxParticipants} participants)`,
        variant: "gray",
        untilTime: null,
        phase: null,
      };
    }

    return {
      subTitle: "Join now!",
      description: "Registration closes in...",
      variant: "green",
      untilTime: joinEndDate,
      phase: "registration",
    };
  }

  // Flow #5
  if (joinEndDate && now >= joinEndDate && votingStartDate === null) {
    return {
      subTitle: "Registration is closed",
      description: "",
      variant: "gray",
      untilTime: null,
      phase: null,
    };
  }

  // Flow #6
  if (votingStartDate && now < votingStartDate) {
    return {
      subTitle: "Get ready!",
      description: "Voting opens in...",
      variant: "blue",
      untilTime: votingStartDate,
      phase: "voting",
    };
  }

  // Flow #7
  if (votingStartDate && votingEndDate === null && now >= votingStartDate) {
    return {
      subTitle: "Boosting is closed!",
      description: "",
      variant: "gray",
      untilTime: null,
      phase: null,
    };
  }

  // Flow #8
  if (votingEndDate && now < votingEndDate) {
    return {
      subTitle: "Get ready!",
      description: "Boosting closes in...",
      variant: "blue",
      untilTime: votingEndDate,
      phase: "boosting",
    };
  }

  // Flow #9
  if (votingEndDate && now >= votingEndDate) {
    if (status === "pending") {
      return {
        subTitle: "Boosting is closed!",
        description: startDate ? "Competition starts in..." : "",
        variant: "gray",
        untilTime: startDate,
        phase: null,
      };
    }
    if (status === "active") {
      return {
        subTitle: "Boosting is closed!",
        description: endDate ? "Competition ends in..." : "",
        variant: "gray",
        untilTime: endDate,
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
