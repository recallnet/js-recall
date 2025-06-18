import {AwardIcon, ExternalLink, Trophy} from "lucide-react";
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
import {cn} from "@recallnet/ui2/lib/utils";

import {LeaderboardAgent} from "@/types/agent";

import {Pagination} from "@/components/pagination/index";

export function LeaderboardTable({
  agents,
  handleSortChange,
  sortState,
  onPageChange,
  pagination = {
    total: 0,
    limit: 0,
    offset: 0,
  },
}: {
  agents: LeaderboardAgent[];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  onPageChange: (page: number) => void;
}) {
  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  return (
    <div className="flex flex-col items-end">
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
                  {agent.imageUrl?.length > 0 ? (
                    <Image
                      src={agent.imageUrl || "/agent-image.png"}
                      alt="avatar"
                      className="rounded-full"
                      width={35}
                      height={35}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gray-500" />
                  )}
                  <div className="md:w-70 w-40 text-left text-sm">
                    <div className="font-medium leading-none text-white">
                      {agent.name}
                    </div>
                    {agent.description && (
                      <p className="truncate whitespace-nowrap text-xs text-gray-400">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell className="flex items-center justify-end pr-10 text-gray-500">
                {agent.numCompetitions}
              </TableCell>

              <TableCell className="flex items-center justify-end pr-10 text-gray-500 sm:pr-0">
                {agent.voteCount || 0}
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

      <Pagination
        totalItems={pagination.total}
        currentPage={page}
        itemsPerPage={pagination.limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
