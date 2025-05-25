"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import React, { useState } from "react";

import { CompetitionResponse } from "@/types/competition";

export interface CompetitionInfoProps {
  competition: CompetitionResponse;
}

export const CompetitionInfo: React.FC<CompetitionInfoProps> = ({
  competition,
}) => {
  const [expanded, setExpanded] = useState(false);

  const startDate = format(
    new Date(competition.startDate),
    "MMMM do, yyyy h:mm a",
  );
  const endDate = format(new Date(competition.endDate), "MMMM do, yyyy h:mm a");

  const SHORT_DESC_LENGTH = 120;
  const isLong = competition.description.length > SHORT_DESC_LENGTH;
  const shortDesc = isLong
    ? competition.description.slice(0, SHORT_DESC_LENGTH) + "..."
    : competition.description;

  return (
    <section className="mx-auto mt-12">
      <h2 className="mb-8 text-3xl font-bold tracking-widest">TL;DR</h2>
      <div className="mb-8 border border-slate-700 p-0">
        <div className="grid grid-cols-1 divide-y divide-slate-700 text-center md:grid-cols-3 md:divide-x">
          {/* PARTICIPANTS */}
          <div className="flex flex-col items-center justify-center py-6 md:py-8">
            <span className="mb-1 text-sm uppercase tracking-widest text-slate-300">
              PARTICIPANTS
            </span>
            <span className="text-sm font-bold">
              {competition.registeredAgents}
            </span>
          </div>
          {/* DATES */}
          <div className="flex flex-col items-center justify-center py-6 md:py-8">
            <span className="mb-1 text-sm uppercase tracking-widest text-slate-300">
              DATES
            </span>
            <span className="text-sm">
              Starts: <time dateTime={competition.startDate}>{startDate}</time>
            </span>
            <span className="text-sm">
              Ends: <time dateTime={competition.endDate}>{endDate}</time>
            </span>
          </div>
          {/* MIN. STAKED */}
          <div className="flex flex-col items-center justify-center py-6 md:py-8">
            <span className="mb-1 text-sm uppercase tracking-widest text-slate-300">
              MIN. STAKED
            </span>
            <span className="text-sm font-bold">
              {competition.minStake} <span className="font-normal">RECALL</span>
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-0 md:grid-cols-3">
        {/* Description with fade/expand */}
        <div className="flex flex-col justify-start md:col-span-2">
          <div
            className={`relative ${expanded ? "max-h-40 overflow-y-auto" : "max-h-16 overflow-hidden"}`}
          >
            <p className="whitespace-pre-line pr-2 text-lg text-slate-100">
              {expanded ? competition.description : shortDesc}
            </p>
            {!expanded && isLong && (
              <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-full bg-gradient-to-t from-black to-transparent" />
            )}
          </div>
          {isLong && (
            <button
              className="mt-2 self-start text-xs text-slate-400 transition-colors hover:text-slate-200"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "SHOW LESS" : "READ MORE"}
            </button>
          )}
        </div>
        {/* Discord Button */}
        <div className="flex h-52 items-end justify-between border border-slate-700 p-6">
          <span className="text-sm font-bold uppercase">
            Join Discord Server
          </span>
          <button
            className="rounded-full p-1.5 hover:bg-slate-700"
            aria-label="View agent details"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
};
