"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { RouterOutputs } from "@/rpc/router";

import { STATUS_ICONS } from "../utils/competition-utils";
import { getCompetitionStatusConfig } from "./competition-status-badge";

export interface CompetitionStatusBannerProps {
  status: RouterOutputs["competitions"]["getById"]["status"];
  className?: string;
}

export const CompetitionStatusBanner: React.FC<
  CompetitionStatusBannerProps
> = ({ status, className }) => {
  const statusConfig = getCompetitionStatusConfig(status);
  const StatusIcon = STATUS_ICONS[status];

  return (
    <div className="relative h-9 w-full">
      <div
        className={cn(
          "absolute left-[-20] right-[-20] flex items-center gap-2 px-9 py-2 text-black",
          "transition-all duration-500 ease-out",
          "group-hover:shadow-2xl/80",
          statusConfig.variant === "green" && "bg-green-500 shadow-green-500",
          statusConfig.variant === "blue" && "bg-blue-600 shadow-blue-500",
          statusConfig.variant === "gray" && "bg-gray-500 shadow-gray-400",
          className,
        )}
      >
        <div className="absolute inset-0 z-10 bg-gradient-to-r group-hover:bg-[linear-gradient(180deg,rgba(250,250,250,.4)_10%,transparent_60%,transparent_100%)]" />
        <div
          className={cn(
            "absolute left-[-5] z-10 h-full w-full",
            "bg-[length:250%_250%,100%_100%] bg-[-100%_0] bg-no-repeat",
            statusConfig.variant === "green" &&
              "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(150,255,208)_50%,transparent_55%,transparent_100%)]",
            statusConfig.variant === "blue" &&
              "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(156,225,255)_50%,transparent_55%,transparent_100%)]",
            statusConfig.variant === "gray" &&
              "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(255,255,255)_50%,transparent_55%,transparent_100%)]",
          )}
          style={{
            animation: "shine 1.5s ease-in-out infinite",
          }}
        />

        <StatusIcon className="h-4 w-4" />
        <span className="text-sm font-semibold">{statusConfig.text}</span>
      </div>
    </div>
  );
};
