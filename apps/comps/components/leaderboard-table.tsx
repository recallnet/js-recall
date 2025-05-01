"use client";

// your button component
import Image from "next/image";
import { useState } from "react";

// your button component
import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/shadcn/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { Agent } from "@/data/agents";

export function LeaderboardTable(props: {
  agents: (Agent & { rank: number })[];
}) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleAgents = props.agents.slice(0, visibleCount);

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-0 text-left">RANK / NAME</TableHead>
            <TableHead>ELO SCORE</TableHead>
            <TableHead>
              <div className="flex justify-center">
                <div className="h-1 w-16 rounded bg-gray-500" />
              </div>
            </TableHead>
            <TableHead>
              <div className="flex justify-center">
                <div className="h-1 w-16 rounded bg-gray-500" />
              </div>
            </TableHead>
            <TableHead className="w-40"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {visibleAgents.map((agent) => (
            <TableRow key={agent.id} className="h-25">
              <TableCell className="w-50">
                <div className="flex items-center justify-start gap-7">
                  <div className="text-sm text-gray-300">{agent.rank}</div>
                  <div className="flex items-center gap-5">
                    <Image
                      src={agent.image || "/agent-image.png"}
                      alt="avatar"
                      width={20}
                      height={20}
                    />
                    <div className="text-sm">
                      <div className="font-medium leading-none text-white">
                        {agent.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {displayAddress(agent.address, {
                          numChars: 5,
                          separator: " . . . ",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-col items-center justify-start gap-2">
                  <div className="h-1 w-16 rounded bg-gray-500" />
                  <div className="h-1 w-10 rounded bg-gray-500" />
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-col items-center justify-start gap-2">
                  <div className="h-1 w-16 rounded bg-gray-500" />
                  <div className="h-1 w-10 rounded bg-gray-500" />
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-col items-center justify-start gap-2">
                  <div className="h-1 w-16 rounded bg-gray-500" />
                  <div className="h-1 w-10 rounded bg-gray-500" />
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="transparent"
                    className="border-1 border-gray-800 p-5 text-gray-500"
                  >
                    PROFILE
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {visibleCount < props.agents.length && (
        <Button
          onClick={() => setVisibleCount((prev) => prev + 10)}
          className="mt-4 w-full"
          variant="outline"
        >
          SHOW MORE
        </Button>
      )}
    </div>
  );
}
