import { useRouter } from "next/navigation";

import { Button } from "@recallnet/ui2/components/button";
import {
  SortState,
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";
import { cn } from "@recallnet/ui2/lib/utils";

import { EigenVerifiedBadge } from "@/components/eigenai-verified-badge";
import { Trophy, TrophyBadge } from "@/components/trophy-badge";
import type { RouterOutputs } from "@/rpc/router";

import RainbowText from "../animations/rainbow-text";

/** Badge status from the eigenai.getBadgeStatusesForAgent endpoint */
type EigenBadgeStatus = {
  competitionId: string;
  isActive: boolean;
  signaturesLast24h: number;
};

type AgentCompetition =
  RouterOutputs["agent"]["getCompetitions"]["competitions"][number];

export function CompetitionTable({
  competitions,
  handleSortChange,
  sortState,
  canClaim,
  onLoadMore,
  total = 0,
  eigenBadgesByCompetition = {},
}: {
  competitions: (AgentCompetition & { trophies: Trophy[] })[];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  canClaim: boolean;
  onLoadMore: () => void;
  total?: number;
  eigenBadgesByCompetition?: Record<string, EigenBadgeStatus>;
}) {
  const router = useRouter();
  const hasMore = total > (competitions?.length || 0);

  // Check if any competition has an EigenAI badge to determine if we show the column
  const hasAnyEigenBadge = Object.keys(eigenBadgesByCompetition).length > 0;

  // Calculate grid columns based on whether we show eigenai column and claim column
  // All columns except Competition (2fr) use 1fr for equal distribution
  const getGridColumns = (): string => {
    if (canClaim && hasAnyEigenBadge) {
      return "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]";
    }
    if (canClaim) {
      return "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]";
    }
    if (hasAnyEigenBadge) {
      return "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]";
    }
    return "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]";
  };

  const gridColumns = getGridColumns();

  // Calculate total column count for empty state colSpan
  // Base: 8 columns, +1 for EigenAI badge, +1 for claim button
  const totalColumns = 8 + (hasAnyEigenBadge ? 1 : 0) + (canClaim ? 1 : 0);

  return (
    <>
      <div className="overflow-x-auto rounded">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className={cn("grid w-full", gridColumns)}>
              <SortableTableHeader
                onToggleSort={() => handleSortChange("name")}
                sortState={sortState["name"]}
              >
                Competition
              </SortableTableHeader>
              {hasAnyEigenBadge && (
                <TableHead className="flex items-center justify-center">
                  EigenAI
                </TableHead>
              )}
              {
                // some fields have sorted removed until they are supported by the api, specifically Trophies and Skills
              }
              <TableHead>Skills</TableHead>
              <SortableTableHeader
                onToggleSort={() => handleSortChange("portfolioValue")}
                sortState={sortState["portfolioValue"]}
              >
                Portfolio
              </SortableTableHeader>
              <SortableTableHeader
                onToggleSort={() => handleSortChange("pnl")}
                sortState={sortState["pnl"]}
              >
                P&L
              </SortableTableHeader>
              <SortableTableHeader
                onToggleSort={() => handleSortChange("totalTrades")}
                sortState={sortState["totalTrades"]}
              >
                Trades
              </SortableTableHeader>
              <SortableTableHeader
                onToggleSort={() => handleSortChange("totalPositions")}
                sortState={sortState["totalPositions"]}
              >
                Positions
              </SortableTableHeader>

              <SortableTableHeader
                onToggleSort={() => handleSortChange("bestPlacement")}
                sortState={sortState["bestPlacement"]}
              >
                Placement
              </SortableTableHeader>
              <TableHead>Trophies</TableHead>
              {canClaim && <TableHead className="text-left">Reward</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {competitions && competitions.length > 0 ? (
              competitions.slice(0, 10).map((comp, i) => {
                const compStatus =
                  comp.status === "active"
                    ? {
                        text: "Ongoing",
                        style: "border-green-500 text-green-500",
                      }
                    : comp.status === "pending"
                      ? {
                          text: "Upcoming",
                          style: "border-blue-500 text-blue-500",
                        }
                      : {
                          text: "Complete",
                          style: "border-gray-500 text-secondary-foreground",
                        };

                return (
                  <TableRow
                    key={i}
                    onClick={() => router.push(`/competitions/${comp.id}`)}
                    className={cn("grid w-full cursor-pointer", gridColumns)}
                  >
                    <TableCell className="flex min-w-0 flex-col justify-center">
                      <span className="text-secondary-foreground block truncate text-sm font-normal">
                        {comp.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 w-fit rounded border px-2 py-0.5 text-xs font-normal",
                          compStatus.style,
                        )}
                      >
                        {compStatus.text}
                      </span>
                    </TableCell>
                    {hasAnyEigenBadge && (
                      <TableCell className="flex items-center justify-center">
                        {eigenBadgesByCompetition[comp.id] ? (
                          <EigenVerifiedBadge
                            isActive={
                              eigenBadgesByCompetition[comp.id]?.isActive ??
                              false
                            }
                            signaturesLast24h={
                              eigenBadgesByCompetition[comp.id]
                                ?.signaturesLast24h ?? 0
                            }
                            size="sm"
                          />
                        ) : (
                          <span className="text-secondary-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="flex flex-wrap items-center gap-2">
                      {/* Future skills mapping */}
                    </TableCell>
                    <TableCell className="text-md text-secondary-foreground font-normal">
                      {comp.type === "perpetual_futures" ? (
                        <div className="flex h-full flex-col justify-center">
                          <span>
                            CR:{" "}
                            {comp.calmarRatio !== null &&
                            comp.calmarRatio !== undefined
                              ? Number(comp.calmarRatio).toFixed(2)
                              : "N/A"}
                          </span>
                          <span className="text-xs text-gray-500">
                            Risk-Adjusted
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full items-center">
                          {typeof comp.portfolioValue === "number"
                            ? `$${comp.portfolioValue.toFixed(2)}`
                            : "N/A"}
                          <span className="ml-2 text-xs">USDC</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="w-30 flex items-center font-normal">
                      <span className="text-secondary-foreground flex flex-col">
                        {typeof comp.pnlPercent === "number"
                          ? `${Math.round(comp.pnlPercent)}%`
                          : "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="w-30 text-md text-secondary-foreground flex items-center text-center font-normal">
                      {comp.totalTrades ?? 0}
                    </TableCell>
                    <TableCell className="w-30 text-md text-secondary-foreground flex items-center text-center font-normal">
                      {comp.totalPositions ?? 0}
                    </TableCell>
                    <TableCell className="w-30 text-secondary-foreground flex items-center text-center">
                      {/* If a comp is pending or active, we show `N/A`; else, an undefined best placement means the agent was DQ'd */}
                      {comp.status === "pending" || comp.status === "active" ? (
                        "N/A"
                      ) : comp.bestPlacement?.rank &&
                        comp.bestPlacement?.totalAgents ? (
                        `${comp.bestPlacement.rank}/${comp.bestPlacement.totalAgents}`
                      ) : (
                        <span className="text-red-400">DQ</span>
                      )}
                    </TableCell>
                    <TableCell className="h-25 ml-1 flex items-center gap-2">
                      {comp.trophies.length > 0 ? (
                        comp.trophies.map((trophy, i: number) => (
                          <TrophyBadge size={50} key={i} trophy={trophy} />
                        ))
                      ) : (
                        <span className="text-secondary-foreground">N/A</span>
                      )}
                    </TableCell>
                    {canClaim && (
                      <TableCell className="align-center h-25 flex items-center gap-2">
                        <RainbowText
                          text="0 USDC"
                          className="cursor-pointer font-bold"
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={totalColumns} className="p-5 text-center">
                  <div className="flex flex-col">
                    <span className="text-secondary-foreground font-normal">
                      This agent hasn&apos;t joined any competitions yet
                    </span>
                    <span className="text-secondary-foreground">
                      Participated competitions will appear here once the agent
                      enters one.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Show More
          </Button>
        </div>
      )}
    </>
  );
}

export default CompetitionTable;
