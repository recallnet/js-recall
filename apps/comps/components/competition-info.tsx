"use client";

import { format } from "date-fns";
import React, { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { Competition } from "@/types/competition";

import { CompetitionStatusBadge } from "./competition-status-badge";

export interface CompetitionInfoProps {
  competition: Competition;
  className?: string;
}

const rainbowTextClass =
  "bg-gradient-to-r from-[#FB8761] via-[#FFD04D] via-[#52C966] to-[#4D49CF] bg-clip-text text-transparent font-bold";

const CellTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-secondary-foreground text-xs font-semibold uppercase tracking-widest">
    {children}
  </span>
);

export const CompetitionInfo: React.FC<CompetitionInfoProps> = ({
  competition,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);

  const startDate = competition.startDate
    ? format(new Date(competition.startDate), "MM/dd")
    : "TBA";
  const endDate = competition.endDate
    ? format(new Date(competition.endDate), "MM/dd")
    : "TBA";

  const SHORT_DESC_LENGTH = 120;
  const isLong =
    competition.description?.length &&
    competition.description.length > SHORT_DESC_LENGTH;
  const shortDesc = isLong
    ? competition.description?.slice(0, SHORT_DESC_LENGTH) + "..."
    : competition.description;

  const rewardAmount = 0;
  const rewardCurrency = "USD";

  const totalTrades = 0;
  const volume = 0;

  return (
    <section className={cn(className, "border text-white")}>
      <div className="grid grid-cols-2 border-b">
        <div className="flex flex-col items-start justify-center gap-2 border-r p-[25px]">
          <CellTitle>Reward</CellTitle>
          <span className={rainbowTextClass}>
            $
            {rewardAmount.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}{" "}
            {rewardCurrency}
          </span>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 p-[25px]">
          <div className="flex w-full items-center justify-between">
            <CellTitle>Status</CellTitle>
            <CompetitionStatusBadge status={competition.status} />
          </div>
          <span>
            {startDate} -- {endDate}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b p-[25px]">
        <CellTitle>Skills</CellTitle>
        {/* <div className="flex flex-wrap gap-2">
          {competition.skills.map((skill, i) => (
            <span key={skill + i} className="rounded border p-2 text-xs">
              {skill}
            </span>
          ))} 
        </div>*/}
      </div>

      <div className="border-b">
        <div className="p-[25px]">
          <CellTitle>About</CellTitle>
          <div
            className={`relative ${expanded ? "max-h-40 overflow-y-auto" : "max-h-16 overflow-hidden"}`}
          >
            <p className="whitespace-pre-line pr-2">
              {expanded ? competition.description : shortDesc}
            </p>
            {!expanded && isLong && (
              <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-full bg-gradient-to-t from-black to-transparent" />
            )}
          </div>
          {isLong && (
            <button
              className="hover: mt-2 self-start transition-colors"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "SHOW LESS" : "READ MORE"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="flex flex-col items-start justify-center gap-2 border-r p-[25px]">
          <CellTitle>Total Trades</CellTitle>
          <span className="font-bold">{totalTrades}</span>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 border-r p-[25px]">
          <CellTitle>Volume</CellTitle>
          <span className="font-bold">
            $
            {volume.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 p-[25px]">
          <CellTitle>Tokens Traded</CellTitle>
          <span className="font-bold">/</span>
        </div>
      </div>
    </section>
  );
};
