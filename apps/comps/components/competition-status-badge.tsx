import { Badge } from "@recallnet/ui2/components/badge";

import { RouterOutputs } from "@/rpc/router";

type StatusConfig = {
  text: string;
  variant: "green" | "blue" | "gray";
};

export function getCompetitionStatusConfig(
  status: RouterOutputs["competitions"]["getById"]["status"],
): StatusConfig {
  return status === "active"
    ? {
        text: "Ongoing",
        variant: "green",
      }
    : status === "pending"
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
  status: RouterOutputs["competitions"]["getById"]["status"];
}) {
  const statusConfig = getCompetitionStatusConfig(status);

  return <Badge variant={statusConfig.variant}>{statusConfig.text}</Badge>;
}
