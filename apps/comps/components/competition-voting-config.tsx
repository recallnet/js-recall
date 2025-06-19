import { Competition, CompetitionStatus } from "@/types";

type VotingStatusConfig = {
  subTitle: string;
  description: string;
  variant: "green" | "blue" | "gray";
  untilTime: Date | null;
  phase: string | null;
};

export function getCompetitionVotingConfig(
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

  // TODO: what defines registration start time?  I'm assuming that if there
  //  isn't a comp start time, then registration is not open.
  if (!compStartDate) {
    return {
      subTitle: "Get ready!",
      description: `Registration ${votingStart ? "opens in..." : "soon"}`,
      variant: "green",
      untilTime: votingStart,
      phase: "registration",
    };
  }

  if (votingStart && now < votingStart) {
    return {
      subTitle: "Get ready!",
      description: "Voting opens in...",
      variant: "blue",
      untilTime: votingStart,
      phase: "voting",
    };
  }
  if (votingEnd && now > votingEnd) {
    return {
      subTitle: "Counting votes!",
      description: compEndDate ? "Competition ends in..." : "",
      variant: "gray",
      untilTime: compEndDate,
      phase: null,
    };
  }

  return {
    subTitle: "Vote now!",
    description: `Voting ${votingEnd ? "closing in..." : "is open"}`,
    variant: "blue",
    untilTime: votingEnd,
    phase: "voting",
  };
}
