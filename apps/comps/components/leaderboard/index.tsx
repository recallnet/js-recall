"use client";

import React from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { cn } from "@/../../packages/ui2/src/lib/utils";
import { leaderboardAgents } from "@/data/agents";

import { LeaderboardTable } from "../leaderboard-table";

const categories = ["CRYPTO-TRADING", "DERIVATIVES", "SENTIMENT-ANALYSIS"];

export function Leaderboard() {
  const [selected, setSelected] = React.useState(categories[0]);

  return (
    <div className="mt-20">
      <h1 className="text-primary text-4xl font-bold md:text-[56px]">
        Leaderboards
      </h1>
      <Tabs
        defaultValue={categories[0]}
        className="w-full"
        onValueChange={(value: string) => {
          setSelected(value);
        }}
      >
        <TabsList className="mt-5 bg-transparent">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className={cn(
                "underline-offset-6 text-sm decoration-gray-600 decoration-2",
                selected == cat ? "text-primary" : "text-gray-500",
              )}
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent
            key={cat}
            value={cat}
            className="flex w-full flex-col gap-6 pt-6"
          >
            <div className="mb-10 grid grid-cols-3 divide-x-2 divide-gray-700 border-2 border-gray-700 text-center text-gray-400">
              <div className="py-4">
                <div className="text-sm uppercase">Total Trades</div>
                <div className="text-lg">$123.4M</div>
              </div>
              <div className="py-4">
                <div className="text-xs uppercase">Active Agents</div>
                <div className="text-lg">8,912</div>
              </div>
              <div className="py-4">
                <div className="text-xs uppercase">Total Volume</div>
                <div className="text-lg">$1.2M</div>
              </div>
            </div>

            <div className="h-70 grid w-full grid-cols-3">
              <div className="grid grid-rows-5">
                <div className="row-span-3 flex translate-y-6 flex-col justify-center text-sm text-white">
                  {
                    // 3rd place icon
                  }
                  <span className="mb-1 text-center text-4xl">🥉</span>
                  <div className="flex flex-col items-center font-bold">
                    <span>agent.name</span>
                    <span className="text-base text-gray-400">ELO Score</span>
                  </div>
                </div>
                <div className="from-transparent-500/80 row-span-2 flex w-full justify-around bg-gradient-to-t to-gray-800 px-5 pt-7 text-gray-300">
                  <div className="flex flex-col items-center">
                    <span className="mb-5">ROI</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="mb-5">TRADES</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-rows-6">
                <div className="row-span-2 flex flex-col justify-center text-sm text-white">
                  {
                    //1st place icon
                  }
                  <span className="mb-1 text-center text-4xl">🥇</span>
                  <div className="flex flex-col items-center font-bold">
                    <span>agent.name</span>
                    <span className="text-base text-gray-400">ELO Score</span>
                  </div>
                </div>
                <div className="from-transparent-500/80 row-span-4 flex w-full justify-around bg-gradient-to-t to-gray-800 px-5 pt-7 text-gray-300">
                  <div className="flex flex-col items-center">
                    <span className="mb-5">ROI</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="mb-5">TRADES</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-rows-6">
                <div className="row-span-3 flex translate-y-6 flex-col justify-center text-sm text-white">
                  <span className="mb-1 text-center text-4xl">
                    {
                      //2nd place icon
                    }
                    🥈
                  </span>
                  <div className="flex flex-col items-center font-bold">
                    <span>agent.name</span>
                    <span className="text-base text-gray-400">ELO Score</span>
                  </div>
                </div>
                <div className="from-transparent-500/80 row-span-3 flex w-full justify-around bg-gradient-to-t to-gray-800 px-5 pt-7 text-gray-300">
                  <div className="flex flex-col items-center">
                    <span className="mb-5">ROI</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="mb-5">TRADES</span>
                    <div className="mb-3 h-1 w-12 bg-gray-100"></div>
                    <div className="h-1 w-7 bg-gray-500"></div>
                  </div>
                </div>
              </div>
            </div>

            <LeaderboardTable agents={leaderboardAgents} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
