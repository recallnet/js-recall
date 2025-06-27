import React from "react";

import { useCompetitions, useUserCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { FeaturedCompetition } from "../featured-competition";

/**
 * Component that fetches and displays the featured competition
 * This component will throw promises when loading, enabling Suspense
 */
export function FeaturedCompetitionSection() {
  const { data: activeCompetitions } = useCompetitions({
    status: CompetitionStatus.Active,
  });

  const { data: upcomingCompetitions } = useCompetitions({
    status: CompetitionStatus.Pending,
  });

  const { data: userCompetitions } = useUserCompetitions();

  const featuredCompetition =
    activeCompetitions?.competitions?.[0] ||
    upcomingCompetitions?.competitions?.[0];

  const featuredCompetitionWithAgents = featuredCompetition
    ? mergeCompetitionsWithUserData(
        [featuredCompetition],
        userCompetitions?.competitions ?? [],
      )[0]
    : null;

  if (!featuredCompetitionWithAgents) {
    return null;
  }

  return <FeaturedCompetition competition={featuredCompetitionWithAgents} />;
}
