import { Trophy } from "lucide-react";

import { cn } from "@recallnet/ui2/lib/utils";

export const AgentBestPlacement = ({
  rank,
  places,
}: {
  rank?: number;
  places?: number;
}) => {
  const rankInfo = {
    1: { color: "text-trophy-first", name: "1st" },
    2: { color: "text-trophy-second", name: "2nd" },
    3: { color: "text-trophy-third", name: "3rd" },
  };

  return (
    <div className="text-primary-foreground flex w-full items-center gap-2 text-left text-lg font-semibold">
      {rank && places ? (
        <>
          <Trophy
            strokeWidth={1.5}
            className={cn(
              "mr-1 inline h-6 w-6",
              rankInfo[rank as 1]?.color || "text-gray-600",
            )}
          />
          <span>{rankInfo[rank as 1]?.name || `${rank}th`}</span> of{" "}
          <span>{places}</span>
        </>
      ) : (
        "No completed yet"
      )}
    </div>
  );
};

export default AgentBestPlacement;
