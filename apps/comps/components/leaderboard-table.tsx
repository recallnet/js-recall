import { AwardIcon, ExternalLink, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
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

import { LeaderboardAgent } from "@/types/agent";

export function LeaderboardTable({
  agents,
  loaded,
  handleSortChange,
  sortState,
  onLoadMore,
  hasMore = false,
}: {
  agents: LeaderboardAgent[];
  loaded?: boolean;

  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  onLoadMore: () => void;
  hasMore?: boolean;
}) {
  return (
    <>
      <Table className="w-full">
        <TableHeader className="bg-gray-900">
          <TableRow className="grid w-full grid-cols-[1fr_2fr_1fr_1fr_1fr]">
            <SortableTableHeader
              className="pl-10 text-white"
              onToggleSort={() => handleSortChange("rank")}
              sortState={sortState["rank"]}
            >
              Rank
            </SortableTableHeader>
            <SortableTableHeader
              className="xs:pl-20 pl-10 text-white"
              onToggleSort={() => handleSortChange("name")}
              sortState={sortState["name"]}
            >
              Agent
            </SortableTableHeader>
            <SortableTableHeader
              className="flex justify-end text-white"
              onToggleSort={() => handleSortChange("competitions")}
              sortState={sortState["competitions"]}
            >
              <div className="w-10 sm:w-full">
                <p className="truncate">Competitions</p>
              </div>
            </SortableTableHeader>
            <SortableTableHeader
              className="flex justify-end text-white"
              onToggleSort={() => handleSortChange("votes")}
              sortState={sortState["votes"]}
            >
              Votes
            </SortableTableHeader>
            <TableHead className="flex justify-end pr-10 text-white">
              Profile
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {agents.map((agent) => (
            <TableRow
              key={agent.id}
              className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr]"
            >
              <TableCell className="xs:flex-row flex flex-col items-center gap-2 py-6">
                {agent.rank === 1 ? (
                  <div
                    className={cn(
                      "flex w-20 items-center justify-center gap-1 rounded bg-[#594100] p-2 text-yellow-500",
                    )}
                  >
                    <Trophy size={17} />
                    <span>1st</span>
                  </div>
                ) : agent.rank === 2 ? (
                  <div
                    className={cn(
                      "flex w-20 items-center justify-center gap-1 rounded bg-gray-700 p-2 text-gray-300",
                    )}
                  >
                    <AwardIcon size={17} />
                    <span>2nd</span>
                  </div>
                ) : agent.rank === 3 ? (
                  <div
                    className={cn(
                      "flex w-20 items-center justify-center gap-1 rounded bg-[#1A0E05] p-2 text-[#C76E29]",
                    )}
                  >
                    <AwardIcon size={17} />
                    <span>3rd</span>
                  </div>
                ) : (
                  <div className="mx-6 flex items-center justify-center rounded bg-gray-800 p-2">
                    {agent.rank}
                  </div>
                )}
              </TableCell>

              <TableCell className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                  {loaded ? (
                    agent.imageUrl?.length > 0 ? (
                      <Image
                        src={agent.imageUrl || "/agent-image.png"}
                        alt="avatar"
                        className="rounded-full"
                        width={35}
                        height={35}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-500" />
                    )
                  ) : (
                    <Skeleton className="h-8 w-8 rounded-full" />
                  )}
                  <div className="md:w-70 w-40 text-left text-sm">
                    {loaded ? (
                      <>
                        <div className="font-medium leading-none text-white">
                          {agent.name}
                        </div>
                        {agent.description && (
                          <p className="truncate whitespace-nowrap text-xs text-gray-400">
                            {agent.description}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Skeleton className="h-2 w-20 rounded-full" />
                        <Skeleton className="w-30 mt-2 h-2 rounded-full" />
                      </>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell className="flex items-center justify-end pr-10 text-gray-500">
                {loaded ? (
                  agent.numCompetitions
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="flex items-center justify-end pr-10 text-gray-500 sm:pr-0">
                {loaded ? (
                  agent.voteCount || 0
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="pr-15 flex items-center justify-end text-gray-500">
                <Link href={`/agents/${agent.id}`}>
                  <ExternalLink />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-6 flex items-center justify-center gap-2">
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Show More
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
