import React from "react";

import { useCompetitions, useUserCompetitions } from "@/hooks/useCompetitions";
import { CompetitionStatus } from "@/types";
import { mergeCompetitionsWithUserData } from "@/utils/competition-utils";

import { CompetitionsCollapsible } from "../competitions-collapsible";

/**
 * Component that fetches and displays active competitions
 * This component will throw promises when loading, enabling Suspense
 */
export function ActiveCompetitions() {
  const { data: activeCompetitions } = useCompetitions({
    status: CompetitionStatus.Active,
  });

  const { data: userCompetitions } = useUserCompetitions();

  if (!activeCompetitions?.competitions?.length) {
    return null;
  }

  return (
    <CompetitionsCollapsible
      title="Active Competitions"
      competitions={mergeCompetitionsWithUserData(
        activeCompetitions.competitions,
        userCompetitions?.competitions ?? [],
      )}
      emptyMessage="No active competitions"
    />
  );
}
