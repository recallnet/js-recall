import { AwardIcon, Trophy } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  SortState,
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
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
  const router = useRouter();

  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-[940px]:min-w-[900px]">
        <div className="flex flex-col items-end">
          <Table className="w-full">
            <TableHeader className="bg-card">
              <TableRow className="grid w-full grid-cols-[1fr_1fr_2fr] min-[940px]:grid-cols-[1fr_1fr_3fr_1fr_1fr]">
                <SortableTableHeader
                  className="pl-6 text-white"
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
                  className="text-white"
                  onToggleSort={() => handleSortChange("name")}
                  sortState={sortState["name"]}
                >
                  Agent
                </SortableTableHeader>
                <SortableTableHeader
                  className="hidden justify-end text-white min-[940px]:flex"
                  onToggleSort={() => handleSortChange("competitions")}
                  sortState={sortState["competitions"]}
                >
                  Competitions
                </SortableTableHeader>
                <SortableTableHeader
                  className="hidden justify-end pr-6 text-white min-[940px]:flex"
                  onToggleSort={() => handleSortChange("votes")}
                  sortState={sortState["votes"]}
                >
                  Votes
                </SortableTableHeader>
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
                    className="grid cursor-pointer grid-cols-[1fr_1fr_2fr] min-[940px]:grid-cols-[1fr_1fr_3fr_1fr_1fr]"
                    onClick={(e) => {
                      // Don't navigate if clicking on some arbitrary inline button
                      const target = e.target as HTMLElement;
                      const isInteractive = target.closest(
                        'button, [type="button"]',
                      );
                      if (!isInteractive) {
                        router.push(`/agents/${agent.id}`);
                      }
                    }}
                  >
                    <TableCell className="xs:flex-row flex flex-col items-center gap-2 pl-6">
                      {agent.rank === 1 ? (
                        <div
                          className={cn(
                            "bg-trophy-first-bg text-trophy-first flex w-20 items-center justify-center gap-1 rounded p-2",
                          )}
                        >
                          <Trophy size={17} />
                          <span>1st</span>
                        </div>
                      ) : agent.rank === 2 ? (
                        <div
                          className={cn(
                            "bg-trophy-second-bg text-trophy-second flex w-20 items-center justify-center gap-1 rounded p-2",
                          )}
                        >
                          <AwardIcon size={17} />
                          <span>2nd</span>
                        </div>
                      ) : agent.rank === 3 ? (
                        <div
                          className={cn(
                            "bg-trophy-third-bg text-trophy-third flex w-20 items-center justify-center gap-1 rounded p-2",
                          )}
                        >
                          <AwardIcon size={17} />
                          <span>3rd</span>
                        </div>
                      ) : (
                        <div className="flex w-20 items-center justify-center rounded bg-gray-700 p-2">
                          {agent.rank}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="flex items-center justify-start text-gray-500">
                      <BigNumberDisplay
                        decimals={scoreSize}
                        value={agent.score.toString()}
                        displayDecimals={0}
                        compact={false}
                      />
                    </TableCell>

                    <TableCell className="flex items-center justify-start overflow-hidden">
                      <div className="flex w-full items-center gap-2">
                        <div className="relative h-[35px] w-[35px] overflow-hidden rounded-full border">
                          <Image
                            src={agent.imageUrl || "/agent-placeholder.png"}
                            alt="avatar"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 text-left text-sm">
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

                    <TableCell className="text-secondary-foreground hidden items-center justify-end min-[940px]:flex">
                      {agent.numCompetitions}
                    </TableCell>

                    <TableCell className="text-secondary-foreground hidden items-center justify-end pr-6 min-[940px]:flex">
                      {agent.voteCount || 0}
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
