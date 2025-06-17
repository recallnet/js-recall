
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

import { Hexagon } from "@/components/hexagon";
import { Competition, CompetitionStatus } from "@/types";

export function CompetitionTable({
  competitions,
  handleSortChange,
  sortState,
  canClaim,

  onLoadMore,
  total = 0,
}: {
  competitions: Competition[] | undefined;
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  canClaim: boolean;
  onLoadMore: () => void;

  total?: number;
}) {
  const hasMore = total > (competitions?.length || 0);

  return (
    <>
      <div className="overflow-hidden rounded border">
        <Table>
          <TableHeader className="text-muted-foreground bg-gray-900 text-xs uppercase">
            <TableRow
              className={cn(
                "grid w-full",
                canClaim ? "grid-cols-8" : "grid-cols-7",
              )}
            >
              <SortableTableHeader
                onToggleSort={() => handleSortChange("name")}
                sortState={sortState["name"]}
              >
                Competition
              </SortableTableHeader>
              {
                //some fields have sorted removed until they are supported by the api
              }
              <TableHead>Skills</TableHead>
              <TableHead>Portfolio</TableHead>
              <TableHead className="w-30 flex justify-end">P&L</TableHead>
              <TableHead>Trades</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Trophies</TableHead>
              {canClaim && <TableHead className="text-left">Reward</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {competitions && competitions.length > 0 ? (
              competitions.slice(0, 10).map((comp, i) => {
                const compStatus =
                  comp.status === CompetitionStatus.Active
                    ? {
                        text: "On-going",
                        style: "border-green-500 text-green-500",
                      }
                    : comp.status === CompetitionStatus.Pending
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
                    className={cn(
                      "grid w-full",
                      canClaim ? "grid-cols-8" : "grid-cols-7",
                    )}
                  >
                    <TableCell className="flex flex-col justify-center">
                      <span className="text-secondary-foreground truncate text-sm font-semibold">
                        {comp.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 w-fit rounded border px-2 py-0.5 text-xs font-medium",
                          compStatus.style,
                        )}
                      >
                        {compStatus.text}
                      </span>
                    </TableCell>
                    <TableCell className="flex flex-wrap items-center gap-2">
                      {/* Future skills mapping */}
                    </TableCell>
                    <TableCell className="text-md text-secondary-foreground flex items-center font-medium">
                      $0<span className="ml-2 text-xs">USDC</span>
                    </TableCell>
                    <TableCell className="w-30 flex items-center justify-center font-medium">
                      <span className="text-secondary-foreground flex flex-col">
                        0$
                      </span>
                    </TableCell>
                    <TableCell className="w-30 text-md fond-semibold text-secondary-foreground flex items-center text-center">
                      0
                    </TableCell>
                    <TableCell className="w-30 text-secondary-foreground flex items-center text-center">
                      0/0
                    </TableCell>
                    <TableCell className="align-center h-25 flex items-center gap-2">
                      <Hexagon className="h-8 w-8 bg-blue-500" />
                      <Hexagon className="h-8 w-8 bg-green-500" />
                      <Hexagon className="h-8 w-8 bg-yellow-500" />
                    </TableCell>
                    {canClaim && (
                      <TableCell className="align-center h-25 flex items-center gap-2">
                        <Button className="rounded bg-sky-700 px-7">
                          Claim
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="p-5 text-center">
                  <div className="flex flex-col">
                    <span className="text-secondary-foreground font-bold">
                      This agent hasn’t joined any competitions yet
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
