"use client";

import Image from "next/image";

import {FaRegThumbsUp} from "react-icons/fa";
import {displayAddress} from "@recallnet/address-utils/display";
import {Button} from "@recallnet/ui2/components/shadcn/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import {useAtom} from "@/node_modules/jotai/react";
import {userAgentAtom, userAtom} from "@/state/atoms";
import {Agent} from "@/state/types";
import AwardIcon from "./agent-podium/award-icon";
import BigNumberDisplay from "./bignumber";

export function LeaderboardTable({agents}: {
  agents: (Agent & {rank: number})[];
}) {
  const [user] = useAtom(userAtom);
  const [userAgent] = useAtom(userAgentAtom);

  return (
    <div className="w-full overflow-x-scroll">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-0 text-left md:w-120">RANK / NAME</TableHead>
            <TableHead>Elo score</TableHead>
            <TableHead>
              ROI
            </TableHead>
            <TableHead>
              Trades
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
                  {userAgent.rank <= 2 ?
                    <AwardIcon className="mr-5" place={['first', 'second', 'third'][userAgent.rank] as 'first'} />
                    :
                    <div className="text-sm text-gray-300 mr-10 bg-gray-900 py-[4px] px-[8px]">{userAgent.rank}</div>
                  }
                  <div className="flex items-center gap-5">
                    <Image
                      src={userAgent.imageUrl || "/agent-image.png"}
                      alt="avatar"
                      width={35}
                      height={35}
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
                      <div className="font-medium leading-none text-white">
                        {userAgent.name}
                      </div>
                      <span className="whitespace-nowrap text-xs text-gray-400">
                        {displayAddress(userAgent.metadata.walletAddress, {
                          numChars: 5,
                          separator: " . . . ",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-center">
                {userAgent.stats.eloAvg}
              </TableCell>

              <TableCell className="text-center">
                <BigNumberDisplay value={userAgent.metadata.roi.toString()} decimals={0} />
                %
              </TableCell>

              <TableCell className="text-center">
                {userAgent.metadata.trades}
              </TableCell>

              <TableCell className="text-gray-500 text-lg text-end">
                <FaRegThumbsUp />
              </TableCell>
            </TableRow>
          )}

          {agents.map((agent) => (
            <TableRow key={agent.id} className="h-25">
              <TableCell className="w-50">
                <div className="flex items-center justify-start">
                  {agent.rank <= 2 ?
                    <AwardIcon className="mr-5" place={['first', 'second', 'third'][agent.rank] as 'first'} />
                    :
                    <div className="text-sm text-gray-300 mr-10 bg-gray-900 py-[4px] px-[8px]">{agent.rank}</div>
                  }
                  <div className="flex items-center gap-5">
                    <Image
                      src={agent.imageUrl || "/agent-image.png"}
                      alt="avatar"
                      width={35}
                      height={35}
                    />
                    <div className="text-sm">
                      <div className="font-medium leading-none text-white">
                        {agent.name}
                      </div>
                      <span className="whitespace-nowrap text-xs text-gray-400">
                        {displayAddress(agent.metadata.walletAddress, {
                          numChars: 5,
                          separator: " . . . ",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-center">
                {agent.stats.eloAvg}
              </TableCell>

              <TableCell className="text-center">
                <BigNumberDisplay value={agent.metadata.roi.toString()} decimals={0} />
                %
              </TableCell>

              <TableCell className="text-center">
                {agent.metadata.trades}
              </TableCell>

              <TableCell className="text-gray-500 text-lg text-end">
                <FaRegThumbsUp />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button
        //onClick={() => setVisibleCount((prev) => prev + 10)}
        className="mt-4 w-full"
        variant="outline"
      >
        SHOW MORE
      </Button>
    </div>
  );
}
