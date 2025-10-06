"use client";

import Image from "next/image";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { Recall } from "@/components/Recall";

interface StakeEntryProps {
  status: "UNSTAKED" | "UNSTAKING";
  amount: string;
  boostAmount: string;
  stakedDate?: string;
  progress?: number;
  progressText?: string;
  unlockDate?: string;
}

const StakeEntry: React.FunctionComponent<StakeEntryProps> = ({
  status,
  amount,
  boostAmount,
  stakedDate,
  progress,
  progressText,
  unlockDate,
}) => {
  return (
    <div className="rounded-lg border border-[#212C3A] bg-gray-900 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="rounded-full bg-[#212C3A] px-3 py-1 text-xs font-medium text-white">
            {status}
          </div>
          <div className="flex items-center gap-2">
            <Recall size="md" />
            <span className="text-lg font-semibold text-white">{amount}</span>
          </div>
          <div className="text-secondary-foreground">→</div>
          <div className="flex items-center gap-1 text-yellow-400">
            <Image
              src="/boost.svg"
              alt="Boost"
              width={16}
              height={16}
              style={{ width: "auto", height: "auto" }}
            />
            <span>{boostAmount}</span>
            <span className="text-secondary-foreground">per competition.</span>
          </div>
        </div>
        <Button variant="outline" disabled={status === "UNSTAKING"}>
          WITHDRAW
        </Button>
      </div>

      {stakedDate && progress !== undefined && progressText && unlockDate && (
        <div className="text-secondary-foreground mt-4 flex items-center justify-between text-sm">
          <span>Staked {stakedDate}</span>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full bg-[#6D85A4] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{progressText}</span>
          </div>
          <span>{unlockDate}</span>
        </div>
      )}
    </div>
  );
};

export const InactiveStakes: React.FunctionComponent = () => {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-bold text-white">Inactive Stakes</h2>
      <div className="space-y-4">
        <StakeEntry status="UNSTAKED" amount="22,000" boostAmount="0" />
        <StakeEntry
          status="UNSTAKING"
          amount="2,000"
          boostAmount="0"
          stakedDate="Nov 23"
          progress={50}
          progressText="07/14 days (50%)"
          unlockDate="Unstakes Dec 22 (3 days)"
        />
      </div>
    </div>
  );
};
