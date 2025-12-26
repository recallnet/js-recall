"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { CompetitionWithUserAgents } from "@/types";
import { formatAmount } from "@/utils/format";

import {
  formatCompetitionDates,
  formatCompetitionType,
} from "../utils/competition-utils";

interface CompetitionCardProps {
  competition: CompetitionWithUserAgents;
  className?: string;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  className,
}) => {
  const duration = formatCompetitionDates(
    competition.startDate,
    competition.endDate,
  );

  const getStatusBadge = (): React.ReactNode => {
    switch (competition.status) {
      case "active":
        return (
          <div className="flex items-center gap-1.5 rounded border border-green-500/30 bg-gray-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            LIVE
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-1.5 rounded border border-blue-400/30 bg-gray-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            SOON
          </div>
        );
      default:
        return null;
    }
  };

  const getBoostingStatus = (): { text: string; isActive: boolean } => {
    if (competition.status === "ended")
      return { text: "Closed", isActive: false };
    if (!competition.endDate) return { text: "TBA", isActive: false };

    const end = new Date(competition.endDate);
    if (end < new Date()) return { text: "Closed", isActive: false };

    const distance = formatDistanceToNow(end, { addSuffix: false });
    // Use short format for days/hours if possible, but date-fns formatDistanceToNow is verbose by default
    // formatDistanceToNow doesn't support short units easily without custom locale,
    // so we'll stick to standard output or simple replace.
    const shortDistance = distance
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" minutes", "m")
      .replace(" minute", "m");

    return { text: `Ends in ${shortDistance}`, isActive: true };
  };

  const getRegistrationStatus = (): string => {
    if (competition.status === "active") return "Open";
    if (competition.status === "pending") return "Open";
    return "Closed";
  };

  const totalRewards = competition.rewardsTge
    ? Number(competition.rewardsTge.agentPool)
    : competition.rewards?.reduce((sum, r) => sum + r.reward, 0) || 0;

  const boostingStatus = getBoostingStatus();
  const registrationStatus = getRegistrationStatus();

  const isEnded = competition.status === "ended";

  return (
    <div
      className={cn(
        "group relative flex w-full flex-col rounded-2xl border pr-2 transition-all duration-300 sm:flex-row sm:items-center",
        isEnded
          ? "border-gray-800/50 bg-gray-900/10 hover:border-gray-800"
          : "border-gray-800 bg-gray-900/20 hover:border-gray-700",
        className,
      )}
    >
      {/* Left: Image & Badge */}
      <div
        className={cn(
          "relative m-3 h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-800 sm:h-24 sm:w-24",
          isEnded ? "opacity-40" : "",
        )}
      >
        {competition.imageUrl ? (
          <Image
            src={competition.imageUrl}
            alt={competition.name}
            fill
            className={cn(
              "object-cover transition-transform duration-500",
              isEnded ? "" : "group-hover:scale-105",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="font-mono text-4xl font-bold text-gray-700">
              R
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">{getStatusBadge()}</div>
      </div>

      {/* Middle: Info */}
      <div className="flex flex-1 flex-col justify-center gap-1 px-4 pb-4 sm:px-0 sm:pb-0 sm:pl-2">
        <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-widest text-gray-500">
          <span>{formatCompetitionType(competition.type)}</span>
          <span className="h-1 w-1 rounded-full bg-gray-700" />
          <span className="font-sans normal-case tracking-normal text-gray-400">
            {duration}
          </span>
        </div>
        <h3
          className={cn(
            "text-xl font-medium tracking-tight",
            isEnded ? "text-gray-400" : "text-white",
          )}
        >
          {competition.name}
        </h3>
        <p className="line-clamp-2 max-w-lg text-xs leading-relaxed text-gray-500">
          {competition.description}
        </p>
      </div>

      {/* Right: Stats & Button */}
      <div className="flex flex-wrap items-center gap-6 border-t border-gray-800 px-4 py-4 sm:flex-nowrap sm:gap-8 sm:border-t-0 sm:py-0 sm:pr-4">
        {/* Stats Group */}
        <div className="flex flex-1 items-center justify-between gap-6 sm:justify-end sm:gap-8">
          {/* Rewards */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-gray-600">
              Rewards
            </span>
            <span
              className={cn(
                "text-lg font-bold",
                isEnded ? "text-gray-400" : "text-white",
              )}
            >
              {totalRewards > 0 ? formatAmount(totalRewards, 0, true) : "0"}
            </span>
          </div>

          {/* Divider */}
          <div className="hidden h-8 w-px bg-gray-800 sm:block" />

          {/* Registration */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-gray-600">
              Registration
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isEnded ? "text-gray-400" : "text-gray-300",
              )}
            >
              {registrationStatus}
            </span>
          </div>

          {/* Boosting */}
          <div className="flex min-w-[100px] flex-col items-center gap-0.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-gray-600">
              Boosting
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-sm font-medium",
                boostingStatus.isActive ? "text-gray-200" : "text-gray-500",
                isEnded && !boostingStatus.isActive ? "text-gray-400" : "",
              )}
            >
              {boostingStatus.isActive ? (
                <>
                  Ends in{" "}
                  <span className="font-bold text-green-400">
                    {boostingStatus.text.replace("Ends in ", "")}
                  </span>
                </>
              ) : (
                boostingStatus.text
              )}
            </span>
          </div>
        </div>

        {/* View Button */}
        <Link
          href={`/competitions/${competition.id}`}
          className="w-full shrink-0 sm:w-auto"
        >
          <Button
            variant={isEnded ? "outline" : "default"}
            className={cn(
              "h-10 w-full rounded-full px-6 font-semibold sm:w-auto",
              isEnded
                ? "border-gray-700 bg-transparent text-gray-100 hover:bg-gray-800 hover:text-white"
                : "bg-white text-black hover:bg-gray-200",
            )}
          >
            View <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};
