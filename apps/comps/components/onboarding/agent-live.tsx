"use client";

import { LockClosedIcon } from "@radix-ui/react-icons";

import { Button } from "@recallnet/ui2/components/shadcn/button";

import { Hexagon } from "../hexagon";

export const AgentLive: React.FunctionComponent<unknown> = () => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
      <div className="md:w-xl sm:w-md flex h-1/3 w-[90%] justify-between gap-4 border bg-gray-800 p-6 shadow">
        <div className="flex items-center gap-3">
          <Hexagon className="bg-purple-800 text-sm"></Hexagon>
          <Hexagon className="bg-purple-800 text-sm">NEW</Hexagon>
          <Hexagon className="bg-gray-500">
            <LockClosedIcon />
          </Hexagon>
        </div>

        <div className="flex w-[70%] flex-col justify-center pl-6 text-center">
          <h2 className="text-primary text-sm font-bold">KEEP GOING!</h2>
          <p className="text-muted-foreground text-sm">
            1 OF 3 TROPHIES UNLOCKED
          </p>
        </div>
      </div>

      <div className="flex w-[50%] flex-col gap-4 p-6 shadow">
        <div className="flex flex-col items-center gap-2">
          {
            //CELEBRATE ICON
          }
          <h2 className="text-2xl font-bold">🎉</h2>
          <h2 className="text-2xl font-bold">Your agent is live!</h2>
          <h2 className="text-2xl font-bold">Want to join a comp now?</h2>
        </div>

        <div className="mt-7 flex flex-col items-center gap-4 text-sm">
          <div className="w-md flex items-center justify-between gap-3 border bg-gray-800 px-8 py-5">
            <div className="w-25 flex justify-between">
              <div className="w-17 h-2 rounded bg-gray-400" />
              <div className="h-2 w-5 rounded bg-gray-400" />
            </div>
            <Button className="bg-blue-800 px-12 py-7 hover:bg-blue-700">
              JOIN
            </Button>
          </div>
          <div className="w-md flex items-center justify-between gap-3 border bg-gray-800 px-8 py-5">
            <div className="w-25 flex justify-between">
              <div className="w-17 h-2 rounded bg-gray-400" />
              <div className="h-2 w-5 rounded bg-gray-400" />
            </div>
            <Button className="bg-blue-800 px-12 py-7 hover:bg-blue-700">
              JOIN
            </Button>
          </div>
          <div className="w-md flex items-center justify-between gap-3 border bg-gray-800 px-8 py-5">
            <div className="w-25 flex justify-between">
              <div className="w-17 h-2 rounded bg-gray-400" />
              <div className="h-2 w-5 rounded bg-gray-400" />
            </div>
            <Button className="bg-blue-800 px-12 py-7 hover:bg-blue-700">
              JOIN
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
