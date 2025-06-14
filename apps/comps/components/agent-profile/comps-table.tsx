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
}: {
  competitions: Competition[] | undefined;
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  canClaim: boolean;
}) {
  return (
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
            <SortableTableHeader
              onToggleSort={() => handleSortChange("skills")}
              sortState={sortState["skills"]}
            >
              Skills
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("portfolio")}
              sortState={sortState["portfolio"]}
            >
              Portfolio
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("pnl")}
              sortState={sortState["pnl"]}
              className="w-30 flex justify-end"
            >
              P&L
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("trades")}
              sortState={sortState["trades"]}
            >
              Trades
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("placement")}
              sortState={sortState["placement"]}
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
                        style: "border-gray-500 text-gray-500",
                      };

              return (
                <TableRow key={i} className="grid grid-cols-8">
                  <TableCell className="flex flex-col justify-center">
                    <span className="truncate text-sm font-semibold text-gray-400">
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
                  <TableCell className="text-md flex items-center font-medium text-gray-400">
                    $0<span className="ml-2 text-xs">USDC</span>
                  </TableCell>
                  <TableCell className="w-30 flex items-center justify-center font-medium">
                    <span className="flex flex-col text-gray-400">0$</span>
                  </TableCell>
                  <TableCell className="w-30 text-md fond-semibold flex items-center text-center text-gray-400">
                    0
                  </TableCell>
                  <TableCell className="w-30 flex items-center text-center text-gray-400">
                    0/0
                  </TableCell>
                  <TableCell className="align-center h-25 flex items-center gap-2">
                    <Hexagon className="h-8 w-8 bg-blue-500" />
                    <Hexagon className="h-8 w-8 bg-green-500" />
                    <Hexagon className="h-8 w-8 bg-yellow-500" />
                  </TableCell>
                  {canClaim && (
                    <TableCell className="align-center h-25 flex items-center gap-2">
                      <Button className="rounded bg-sky-700 px-7">Claim</Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="p-5 text-center">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-400">
                    This agent hasn’t joined any competitions yet
                  </span>
                  <span className="text-gray-600">
                    Participated competitions will appear here once the agent
                    enters one.
                  </span>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {competitions && competitions.length > 10 && (
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableBody>
              {competitions.slice(10).map((comp, i) => (
                <TableRow key={i}>{/* Same structure */}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default CompetitionTable;
