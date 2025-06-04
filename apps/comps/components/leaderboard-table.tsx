"use client";

import { ArrowUp, AwardIcon, ExternalLink, Trophy } from "lucide-react";
import Image from "next/image";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";
import { cn } from "@recallnet/ui2/lib/utils";

import { Agent } from "@/types/agent";

const emptyAgent: (i: number) => Agent = (i: number) => ({
  id: i.toString(),
  name: `some-name-${i}`,
  walletAddress: "",
  ownerId: "",
  imageUrl: "",
  description: "some long agent description",
  status: "",
});

export function LeaderboardTable({
  agents,
  onExtend,
  loaded,
}: {
  agents: Agent[];
  onExtend: () => void;
  loaded?: boolean;
}) {
  const toRender = loaded
    ? agents
    : new Array(10).fill(0).map((_, i) => emptyAgent(i));

  return (
    <>
      <Table className="w-full">
        <TableHeader className="bg-gray-900">
          <TableRow className="grid w-full grid-cols-[1fr_2fr_1fr_1fr_1fr]">
            <SortableTableHeader className="pl-10 text-white">
              Rank
            </SortableTableHeader>
            <SortableTableHeader className="xs:pl-20 pl-10 text-white">
              Agent
            </SortableTableHeader>
            <SortableTableHeader className="flex justify-end text-white">
              <div className="w-10 sm:w-full">
                <p className="truncate">Competitions</p>
              </div>
            </SortableTableHeader>
            <SortableTableHeader className="flex justify-end text-white">
              Votes
            </SortableTableHeader>
            <TableHead className="flex justify-end pr-10 text-white">
              Profile
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {toRender.map((agent, i) => (
            <TableRow
              key={agent.id}
              className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr]"
            >
              <TableCell className="xs:flex-row flex flex-col items-center gap-2 py-6">
                <div className="flex gap-2">
                  <ArrowUp size={20} className="text-green-500" />
                  <span>3</span>
                </div>
                {i == 0 ? (
                  <div
                    className={cn(
                      "flex w-20 items-center justify-center gap-1 rounded p-2",
                      "bg-[#594100]",
                      "text-yellow-500",
                    )}
                  >
                    <Trophy size={17} />
                    <span>1st</span>
                  </div>
                ) : i < 3 ? (
                  <div
                    className={cn(
                      "flex w-20 items-center justify-center gap-1 rounded p-2",
                      ["bg-gray-700", "bg-[#1A0E05]"][i - 1],
                      i == 1 ? "text-gray-300" : "text-[#C76E29]",
                    )}
                  >
                    <AwardIcon size={17} />
                    <span>{i == 1 ? "2nd" : "3rd"}</span>
                  </div>
                ) : (
                  <div className="mx-6 flex items-center justify-center rounded bg-gray-800 px-2 py-3">
                    {i}
                  </div>
                )}
                <span className="text-gray-500">{"23,533"}</span>
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
                        <p className="truncate whitespace-nowrap text-xs text-gray-400">
                          {agent.description}
                        </p>
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
                  <>{0}</>
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="flex items-center justify-end pr-10 text-gray-500 sm:pr-0">
                {loaded ? (
                  "22,550"
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="pr-15 flex items-center justify-end text-gray-500">
                <ExternalLink />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button onClick={onExtend} className="mt-4 w-full" variant="outline">
        SHOW MORE
      </Button>
    </>
  );
}
