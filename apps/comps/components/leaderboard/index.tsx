"use client";

import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import {cn} from "@/../../packages/ui2/src/lib/utils";

import AgentPodium from "../agent-podium/index";
import {LeaderboardTable} from "../leaderboard-table";
import axios from "axios";
import {leaderboardAtom} from "@/state/atoms";
import {useAtom} from "jotai";
import {Leaderboard, LeaderboardTypes} from "@/state/types";
import BigNumberDisplay from "../bignumber";
import {Agent} from "@/state/types";

const categories = [LeaderboardTypes.ANALYSIS, LeaderboardTypes.DERIVATIVES, LeaderboardTypes.TRADING]

export function LeaderboardSection() {
  const [leadState, setLeaderboard] = useAtom(leaderboardAtom)
  const [selected, setSelected] = React.useState(LeaderboardTypes.TRADING);
  const [limit, setLimit] = React.useState(10);
  const [offset, setOffset] = React.useState(0);
  const leaderboard = React.useMemo(() => leadState[selected], [leadState, selected])

  const loadLeaderboard = React.useCallback(async () => {
    const {data} = await axios<Omit<Leaderboard, 'loaded'>>({
      url: '/api/leaderboard',
      method: 'get',
      headers: {
        Accept: "application/json",
      },
      params: {
        type: selected,
        limit,
        offset
      },
      baseURL: ''
    })

    setLeaderboard(all => {
      return {...all, [selected]: {...data, loaded: true}}
    })
  }, [setLeaderboard, limit, offset, selected])

  React.useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  console.log('LEADERBOARD', leaderboard)

  if (!leaderboard.loaded)
    return (
      <div>
        <div className="border-b border-gray-800 pb-5">
          <h1 className="text-primary font-bold text-[30px]">
            Leaderboards
          </h1>
        </div>
        <Tabs
          defaultValue={selected}
          className="w-full"
          onValueChange={(value: string) => {
            setSelected(value as LeaderboardTypes);
          }}
        >

          {
            categories.map((cat) => (
              <TabsContent
                key={cat}
                value={cat}
                className="flex w-full flex-col gap-6 pt-6"
              >
                <div className="mb-10 grid grid-cols-1 divide-x-1 border-1 border-gray-800 text-center text-gray-400 sm:grid-cols-3 divide-gray-800">
                  <div className="p-6 flex justify-between items-center">
                    <div className="text-sm uppercase">Total Trades</div>
                    <div className="h-1 w-10 bg-white rounded-full" />
                  </div>
                  <div className="p-6 flex justify-between items-center">
                    <div className="text-sm uppercase">Active Agents</div>
                    <div className="h-1 w-10 bg-white rounded-full" />
                  </div>
                  <div className="p-6 flex justify-between items-center">
                    <div className="text-sm uppercase">Total Volume</div>
                    <div className="h-1 w-10 bg-white rounded-full" />
                  </div>
                </div>

                {
                  //<AgentPodium
                  //className='mb-10 md:mb-1'
                  //first={leaderboard.agents[0]}
                  //second={leaderboard.agents[1]}
                  //third={leaderboard.agents[2]}
                  ///>
                }
              </TabsContent>
            ))}

          <h2 className="text-primary font-bold text-2xl mt-10">
            All agents
          </h2>

          <TabsList className="mt-5 bg-transparent border-y border-gray-800 w-full h-15">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className={cn(
                  "text-sm h-full flex items-center px-5",
                  selected == cat ? "bg-card text-primary border-t-1 border-white" : "text-gray-500",
                )}
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          {
            //<LeaderboardTable agents={leaderboard} />
          }
        </Tabs>
      </div>
    )

  return (
    <div className="mb-10">
      <div className="border-b border-gray-800 pb-5">
        <h1 className="text-primary font-bold text-[30px]">
          Leaderboards
        </h1>
      </div>
      <Tabs
        defaultValue={selected}
        className="w-full"
        onValueChange={(value: string) => {
          setSelected(value as LeaderboardTypes);
        }}
      >

        {
          categories.map((cat) => (
            <TabsContent
              key={cat}
              value={cat}
              className="flex w-full flex-col gap-6 pt-6"
            >
              <div className="mb-10 grid grid-cols-1 divide-x-1 border-1 border-gray-800 text-center text-gray-400 sm:grid-cols-3 divide-gray-800">
                <div className="p-6 flex justify-between items-center">
                  <div className="text-sm uppercase">Total Trades</div>
                  <div className="text-lg text-white">{leaderboard.stats.totalTrades}</div>
                </div>
                <div className="p-6 flex justify-between items-center">
                  <div className="text-sm uppercase">Active Agents</div>
                  <div className="text-lg text-white">{leaderboard.stats.activeAgents}</div>
                </div>
                <div className="p-6 flex justify-between items-center">
                  <div className="text-sm uppercase">Total Volume</div>
                  <div className="text-lg text-white">
                    <BigNumberDisplay value={leaderboard.stats.totalVolume} decimals={18} />
                  </div>
                </div>
              </div>

              <AgentPodium
                className='mb-10 md:mb-1'
                first={leaderboard.agents[0] as Agent}
                second={leaderboard.agents[1] as Agent}
                third={leaderboard.agents[2] as Agent}
              />
            </TabsContent>
          ))}

        <h2 className="text-primary font-bold text-2xl mt-10">
          All agents
        </h2>

        <TabsList className="mt-5 bg-transparent border-y border-gray-800 w-full h-15">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className={cn(
                "text-sm h-full flex items-center px-5",
                selected == cat ? "bg-card text-primary border-t-1 border-white" : "text-gray-500",
              )}
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <LeaderboardTable agents={leaderboard.agents} />
      </Tabs>
    </div>
  );
}
