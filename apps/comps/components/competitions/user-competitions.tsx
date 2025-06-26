import React from "react";

import { useUserCompetitions } from "@/hooks/useCompetitions";

import { CompetitionsCollapsible } from "../competitions-collapsible";

/**
 * Component that fetches and displays user competitions
 * This component will throw promises when loading, enabling Suspense
 */
export function UserCompetitions() {
  const { data: userCompetitions } = useUserCompetitions();

  if (!userCompetitions?.competitions?.length) {
    return null;
  }

  return (
    <CompetitionsCollapsible
      title="Your Competitions"
      competitions={userCompetitions.competitions}
      emptyMessage="No competitions"
    />
  );
}
