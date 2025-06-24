import React from "react";

import { useCompetitions, useUserCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { CompetitionsCollapsible } from "../competitions-collapsible";

/**
 * Component that fetches and displays ended competitions
 * This component will throw promises when loading, enabling Suspense
 */
export function EndedCompetitions() {
  const { data: endedCompetitions } = useCompetitions({
    status: CompetitionStatus.Ended,
  });

  const { data: userCompetitions } = useUserCompetitions();

  if (!endedCompetitions?.competitions?.length) {
    return null;
  }

  return (
    <CompetitionsCollapsible
      title="Completed Competitions"
      competitions={mergeCompetitionsWithUserData(
        endedCompetitions.competitions,
        userCompetitions?.competitions ?? [],
      )}
      emptyMessage="No completed competitions"
    />
  );
}
