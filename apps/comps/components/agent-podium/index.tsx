import React from "react";

import { cn } from "@/../../packages/ui2/src/lib/utils";
import { Agent } from "@/types";

interface AgentPodiumProps {
  first: Agent;
  second: Agent;
  third: Agent;
  className?: string;
}

export const AgentPodium: React.FC<AgentPodiumProps> = ({
  first,
  second,
  third,
  className,
}) => {
  return (
    <div
      className={cn(
        "md:h-70 mb-10 grid w-full grid-cols-1 md:mb-1 md:grid-cols-3",
        className,
      )}
    >
      <div className="order-3 grid grid-rows-5 md:order-1">
        <div className="row-span-3 flex translate-y-6 flex-col justify-center text-sm text-white">
          {
            // 3rd place icon
          }
          <span className="mb-1 text-center text-4xl">🥉</span>
          <div className="flex flex-col items-center font-bold">
            <span>{first.name}</span>
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
      <div className="order-1 grid grid-rows-5 md:order-2 md:grid-rows-6">
        <div className="row-span-3 flex flex-col justify-center text-sm text-white md:row-span-2">
          {
            //1st place icon
          }
          <span className="mb-1 text-center text-4xl">🥇</span>
          <div className="flex flex-col items-center font-bold">
            <span>{second.name}</span>
            <span className="text-base text-gray-400">ELO Score</span>
          </div>
        </div>
        <div className="from-transparent-500/80 row-span-2 flex w-full justify-around bg-gradient-to-t to-gray-800 px-5 pt-7 text-gray-300 md:row-span-4">
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
      <div className="order-2 grid grid-rows-5 md:order-3 md:grid-rows-6">
        <div className="row-span-3 flex translate-y-6 flex-col justify-center text-sm text-white">
          <span className="mb-1 text-center text-4xl">
            {
              //2nd place icon
            }
            🥈
          </span>
          <div className="flex flex-col items-center font-bold">
            <span>{third.name}</span>
            <span className="text-base text-gray-400">ELO Score</span>
          </div>
        </div>
        <div className="from-transparent-500/80 row-span-2 flex w-full justify-around bg-gradient-to-t to-gray-800 px-5 pt-7 text-gray-300 md:row-span-3">
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
  );
};

export default AgentPodium;
