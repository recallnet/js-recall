"use client";

import { Button } from "@recallnet/ui2/components/shadcn/button";

import { AchievementCard } from "@/components/achievement-card";

export const AgentLive: React.FunctionComponent<unknown> = () => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
      <AchievementCard
        achievements={[
          { locked: false },
          { content: "NEW", locked: false },
          { locked: true },
        ]}
      />

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
