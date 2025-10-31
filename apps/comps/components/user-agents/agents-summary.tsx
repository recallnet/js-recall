"use client";

import { Trophy } from "lucide-react";

import { cn } from "@recallnet/ui2/lib/utils";

import BigNumberDisplay from "@/components/bignumber";
import { useCompetition } from "@/hooks";
import { Agent } from "@/types";
import { toOrdinal } from "@/utils/format";

export const AgentsSummary: React.FunctionComponent<{
  className?: string;
  nAgents?: number;
  bestPlacement?: NonNullable<Agent["stats"]>["bestPlacement"];
  completedComps: number;
  highest: number | null;
}> = ({ bestPlacement, nAgents = 0, completedComps, highest, className }) => {
  const borderRules =
    nAgents >= 4 ? "xs:border-r-1 border-b-1" : "border-b-1 xs:border-r-1";

  return (
    <div
      className={cn(
        className,
        "grid w-full min-w-0 grid-cols-1 grid-rows-3 rounded-xl border",
        {
          "xs:grid-cols-3 xs:grid-rows-1": nAgents >= 4,
          "xs:grid-cols-3 xs:grid-rows-1 lg:h-87 lg:grid-cols-1 lg:grid-rows-3":
            nAgents == 3,
          "xs:grid-cols-3 xs:grid-rows-1 sm:h-87 sm:grid-cols-1 sm:grid-rows-3":
            nAgents < 3,
          "xs:grid-cols-1 xs:grid-rows-3 xs:h-87": nAgents == 1,
        },
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col items-start gap-2 p-4",
          borderRules,
        )}
      >
        <span className="text-secondary-foreground uppercase">
          BEST PLACEMENT
        </span>
        <div className={cn("flex w-full flex-row items-center gap-3")}>
          <div className="flex items-center gap-3">
            <Trophy className="text-2xl text-yellow-500" />
            <span className="text-nowrap text-2xl font-semibold text-white">
              {bestPlacement?.rank && bestPlacement.rank !== Infinity
                ? `${toOrdinal(bestPlacement.rank)} of ${bestPlacement.totalAgents} `
                : "N/A"}
            </span>
          </div>
          <span className="text-secondary-foreground truncate">
            {bestPlacement?.competitionId && (
              <CompetitionName id={bestPlacement.competitionId} />
            )}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "flex w-full flex-col items-start gap-2 p-4",
          borderRules,
        )}
      >
        <span className="text-secondary-foreground uppercase">
          completed competitions
        </span>
        <span className="text-2xl font-semibold text-white">
          {completedComps}
        </span>
      </div>
      <div
        className={cn(
          "flex w-full flex-col items-start gap-2 p-4",
          borderRules,
        )}
      >
        <span className="text-secondary-foreground uppercase">highest p&l</span>
        {highest && highest !== Number.MIN_SAFE_INTEGER ? (
          <span className="text-2xl font-semibold">
            <BigNumberDisplay value={highest.toString()} decimals={0} /> USD
          </span>
        ) : (
          <span>N/A</span>
        )}
      </div>
    </div>
  );
};

const CompetitionName: React.FunctionComponent<{ id: string }> = ({ id }) => {
  const { data: competition } = useCompetition(id);
  return <>{competition?.name}</>;
};

export default AgentsSummary;
