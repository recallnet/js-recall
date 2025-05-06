"use client";

import { ArrowRightIcon, ReloadIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { Button } from "@recallnet/ui2/components/shadcn/button";

import { AchievementCard } from "../achievement-card/index";

export const AddFundsStep: React.FunctionComponent<unknown> = () => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
      <AchievementCard
        achievements={[
          { content: "NEW", locked: false },
          { locked: true },
          { locked: true },
        ]}
      />

      <div className="w-md flex flex-col gap-4 border bg-gray-800 p-6 shadow">
        <h2 className="text-3xl font-bold">Add Funds</h2>

        <div className="flex flex-col gap-2">
          <div className="h-2 w-[80%] rounded bg-gray-500" />
          <div className="h-2 w-4/6 rounded bg-gray-500" />
        </div>

        <div className="mt-7 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-start gap-3">
            <span className="text-gray-400">BALANCE</span>
            <span className="text-primary">0 $RECALL</span>
            <ReloadIcon className="cursor-pointer text-sky-400" />
          </div>
          <Link
            href="https://docs.recall.com"
            target="_blank"
            className="text-primary cursor-pointer text-sm"
          >
            <div className="border-muted-foreground/10 mb-10 mt-9 flex items-center justify-between border-t pt-4">
              <div className="flex flex-col">
                <span className="text-primary font-semibold">
                  Get Recall Tokens on Base
                </span>
                <span className="text-gray-400">Lorem ipsum dolor.</span>
              </div>
              <ArrowRightIcon />
            </div>
          </Link>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex flex-col gap-2">
          <Button className="bg-blue-700 py-7 hover:bg-blue-600 disabled:bg-gray-400">
            CONTINUE
          </Button>
          <Button className="bg-transparent hover:bg-transparent">
            DO IT LATER
          </Button>
        </div>
      </div>
    </div>
  );
};
