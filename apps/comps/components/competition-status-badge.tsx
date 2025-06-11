import { Badge } from "@recallnet/ui2/components/badge";

import { CompetitionStatus } from "@/types";

type StatusConfig = {
  text: string;
  variant: "green" | "blue" | "gray";
};

export function getCompetitionStatusConfig(
  status: CompetitionStatus,
): StatusConfig {
  return status === CompetitionStatus.Active
    ? {
        text: "On-going",
        variant: "green",
      }
    : status === CompetitionStatus.Pending
      ? {
          text: "Upcoming",
          variant: "blue",
        }
      : {
          text: "Complete",
          variant: "gray",
        };
}

export function CompetitionStatusBadge({
  status,
}: {
  status: CompetitionStatus;
}) {
  const statusConfig = getCompetitionStatusConfig(status);

  return <Badge variant={statusConfig.variant}>{statusConfig.text}</Badge>;
}
