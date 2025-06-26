import React from "react";

import { useCompetitions, useUserCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { CompetitionsCollapsible } from "../competitions-collapsible";

/**
 * Component that fetches and displays upcoming competitions
 * This component will throw promises when loading, enabling Suspense
 */
export function UpcomingCompetitions() {
  const { data: upcomingCompetitions } = useCompetitions({
    status: CompetitionStatus.Pending,
  });

  const { data: userCompetitions } = useUserCompetitions();

  if (!upcomingCompetitions?.competitions?.length) {
    return null;
  }

  return (
    <CompetitionsCollapsible
      title="Upcoming Competitions"
      competitions={mergeCompetitionsWithUserData(
        upcomingCompetitions.competitions,
        userCompetitions?.competitions ?? [],
      )}
      emptyMessage="No upcoming competitions"
    />
  );
}
