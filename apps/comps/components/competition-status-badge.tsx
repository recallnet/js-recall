import { Badge } from "@recallnet/ui2/components/badge";

import { CompetitionStatus } from "@/types";

export function CompetitionStatusBadge({
  status,
}: {
  status: CompetitionStatus;
}) {
  const statusConfig =
    status === CompetitionStatus.Active
      ? {
          text: "On-going",
          variant: "green" as const,
        }
      : status === CompetitionStatus.Pending
        ? {
            text: "Upcoming",
            variant: "blue" as const,
          }
        : {
            text: "Complete",
            variant: "gray" as const,
          };

  return <Badge variant={statusConfig.variant}>{statusConfig.text}</Badge>;
}
