import { AwardIcon, ExternalLink, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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

import { Pagination } from "@/components/pagination/index";
import { LeaderboardAgent } from "@/types/agent";
import { PaginationResponse } from "@/types/api";

import BigNumberDisplay from "../bignumber/index";

export function LeaderboardTable({
  agents,
  handleSortChange,
  sortState,
  onPageChange,
  pagination = {
    hasMore: false,
    total: 0,
    limit: 0,
    offset: 0,
  },
}: {
  agents: LeaderboardAgent[];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  pagination?: PaginationResponse;
  onPageChange: (page: number) => void;
}) {
  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="flex flex-col items-end">
          <Table className="w-full">
            <TableHeader className="bg-card">
              <TableRow className="grid w-full grid-cols-[1fr_1fr_2fr_150px_1fr_1fr]">
                <SortableTableHeader
                  className="mr-15 pl-[24px] text-white"
                  onToggleSort={() => handleSortChange("rank")}
                  sortState={sortState["rank"]}
                >
                  Rank
                </SortableTableHeader>
                <SortableTableHeader
                  onToggleSort={() => handleSortChange("score")}
                  sortState={sortState["score"]}
                >
                  Score
                </SortableTableHeader>
                <SortableTableHeader
                  className="pl-10 text-white"
                  onToggleSort={() => handleSortChange("name")}
                  sortState={sortState["name"]}
                >
                  Agent
                </SortableTableHeader>
                <SortableTableHeader
                  className="flex w-full justify-end truncate text-white"
                  onToggleSort={() => handleSortChange("competitions")}
                  sortState={sortState["competitions"]}
                >
                  Competitions
                </SortableTableHeader>
                <SortableTableHeader
                  className="flex justify-end text-white"
                  onToggleSort={() => handleSortChange("votes")}
                  sortState={sortState["votes"]}
                >
                  Votes
                </SortableTableHeader>
                <TableHead className="flex justify-end pr-[24px] text-white">
                  Profile
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const scoreSplit = agent.score.toString().split(".");
                const scoreSize =
                  scoreSplit.length > 0 ? scoreSplit[1]?.length || 0 : 0;

                return (
                  <TableRow
                    key={agent.id}
                    className="grid grid-cols-[1fr_1fr_2fr_150px_1fr_1fr]"
                  >
                    <TableCell className="xs:flex-row mr-10 flex flex-col items-center gap-2 pl-[24px]">
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
                        <div className="flex w-20 items-center justify-center rounded bg-gray-800 p-2">
                          {agent.rank}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="flex items-center justify-start pr-10 text-gray-500">
                      <BigNumberDisplay
                        decimals={scoreSize}
                        value={agent.score.toString()}
                        displayDecimals={0}
                        compact={false}
                      />
                    </TableCell>

                    <TableCell className="flex items-center justify-center pl-10">
                      <div className="flex items-center gap-2">
                        <div className="relative h-[35px] w-[35px] overflow-hidden rounded-full border">
                          <Image
                            src={agent.imageUrl || "/agent-placeholder.png"}
                            alt="avatar"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="md:w-70 w-40 text-left text-sm">
                          <div className="text-secondary-foreground mb-2 truncate font-medium leading-none">
                            {agent.name}
                          </div>
                          {agent.description && (
                            <p className="truncate whitespace-nowrap text-xs font-light text-gray-500">
                              {agent.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-secondary-foreground flex items-center justify-end">
                      {agent.numCompetitions}
                    </TableCell>

                    <TableCell className="text-secondary-foreground flex items-center justify-end">
                      {agent.voteCount || 0}
                    </TableCell>

                    <TableCell className="text-secondary-foreground flex items-center justify-end pr-[32px]">
                      <Link href={`/agents/${agent.id}`}>
                        <ExternalLink />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            totalItems={pagination.total}
            currentPage={page}
            itemsPerPage={pagination.limit}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}
