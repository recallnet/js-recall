"use client";

import { useAtom } from "jotai";
import Image from "next/image";
import { FaRegThumbsUp } from "react-icons/fa";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/shadcn/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { userAgentAtom, userAtom } from "@/state/atoms";
import { LeaderboardAgent } from "@/types/agent";

import AwardIcon from "./agent-podium/award-icon";

const emptyAgent: (i: number) => LeaderboardAgent = (i: number) => ({
  id: i.toString(),
  rank: i + 1,
  imageUrl: "",
  name: "",
  metadata: {},
});

export function LeaderboardTable({
  agents,
  onExtend,
  loaded,
}: {
  agents: LeaderboardAgent[];
  onExtend: () => void;
  loaded?: boolean;
}) {
  const [user] = useAtom(userAtom);
  const [userAgent] = useAtom(userAgentAtom);
  const toRender = loaded
    ? agents
    : new Array(10).fill(0).map((_, i) => emptyAgent(i));

  return (
    <div className="w-full overflow-x-scroll">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="md:w-120 px-0 text-left">
              RANK / NAME
            </TableHead>
            <TableHead>Elo score</TableHead>
            <TableHead>ROI</TableHead>
            <TableHead>Trades</TableHead>
            <TableHead className="w-40"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {user.loggedIn || (
            <TableRow key={userAgent.id} className="h-25 bg-card">
              <TableCell className="w-50">
                <div className="flex items-center justify-start">
                  {userAgent.rank <= 3 ? (
                    <AwardIcon
                      className="mr-5"
                      place={
                        ["first", "second", "third"][
                          userAgent.rank - 1
                        ] as "first"
                      }
                    />
                  ) : (
                    <div className="mr-10 bg-gray-900 px-[8px] py-[4px] text-sm text-gray-300">
                      {userAgent.rank}
                    </div>
                  )}
                  <div className="flex items-center gap-5">
                    <Image
                      src={userAgent.imageUrl || "/agent-image.png"}
                      alt="avatar"
                      width={35}
                      height={35}
                    />
                    <div className="text-sm">
                      <div className="font-medium leading-none text-white">
                        {userAgent.name}
                      </div>
                      <span className="whitespace-nowrap text-xs text-gray-400">
                        {displayAddress(
                          userAgent.metadata.walletAddress || "",
                          {
                            numChars: 5,
                            separator: " . . . ",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-center">
                {userAgent.score || 0}
              </TableCell>

              <TableCell className="text-center">
                {`${userAgent.metadata.roi?.toFixed(2) || 0}%`}
              </TableCell>

              <TableCell className="text-center">
                {userAgent.metadata.trades}
              </TableCell>

              <TableCell className="text-end text-lg text-gray-500">
                <FaRegThumbsUp />
              </TableCell>
            </TableRow>
          )}

          {toRender.map((agent) => (
            <TableRow key={agent.id} className="h-25">
              <TableCell className="w-50">
                <div className="flex items-center justify-start">
                  {agent.rank <= 3 ? (
                    <AwardIcon
                      className="mr-5"
                      place={
                        ["first", "second", "third"][agent.rank - 1] as "first"
                      }
                    />
                  ) : (
                    <div className="mr-10 bg-gray-900 px-[8px] py-[4px] text-sm text-gray-300">
                      {agent.rank}
                    </div>
                  )}
                  <div className="flex items-center gap-5">
                    {loaded ? (
                      <Image
                        src={agent.imageUrl || "/agent-image.png"}
                        alt="avatar"
                        width={35}
                        height={35}
                      />
                    ) : (
                      <Skeleton className="h-8 w-8 rounded-full" />
                    )}
                    <div className="text-sm">
                      {loaded ? (
                        <div className="font-medium leading-none text-white">
                          {agent.name}
                        </div>
                      ) : (
                        <Skeleton className="h-2 w-20 rounded-full" />
                      )}
                      {loaded ? (
                        <span className="whitespace-nowrap text-xs text-gray-400">
                          {displayAddress(agent.metadata.walletAddress || "", {
                            numChars: 5,
                            separator: " . . . ",
                          })}
                        </span>
                      ) : (
                        <Skeleton className="w-30 mt-2 h-2 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-center">
                {loaded ? (
                  agent.score
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="text-center">
                {loaded ? (
                  <>{`${agent.metadata.roi?.toFixed(2) || "0"}%`}</>
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="text-center">
                {loaded ? (
                  agent.metadata.trades
                ) : (
                  <Skeleton className="h-2 w-10 rounded-full" />
                )}
              </TableCell>

              <TableCell className="text-end text-lg text-gray-500">
                <FaRegThumbsUp />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button onClick={onExtend} className="mt-4 w-full" variant="outline">
        SHOW MORE
      </Button>
    </div>
  );
}
