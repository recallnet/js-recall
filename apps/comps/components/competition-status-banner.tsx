"use client";

import React from "react";

import {cn} from "@recallnet/ui2/lib/utils";

import {CompetitionStatus} from "@/types";

import {STATUS_ICONS} from "../utils/competition-utils";
import {getCompetitionStatusConfig} from "./competition-status-badge";

export interface CompetitionStatusBannerProps {
  status: CompetitionStatus;
  className?: string;
}

export const CompetitionStatusBanner: React.FC<
  CompetitionStatusBannerProps
> = ({status, className}) => {
  const statusConfig = getCompetitionStatusConfig(status);
  const StatusIcon = STATUS_ICONS[status];
  const rgbaBright = {
    green: 'rgba(74,222,128)_50%',
    blue: 'rgba(96,165,250)_50%',
    gray: 'rgba(163,163,163)_50%',
  }

  return (
    <div className="relative w-full h-9">
      <div
        className={cn(
          "flex items-center gap-2 px-9 py-2 text-black absolute left-[-20] right-[-20]",
          "transition-all duration-500 ease-out",
          "group-hover:shadow-2xl/80",
          statusConfig.variant === "green" && "bg-green-500 shadow-green-500",
          statusConfig.variant === "blue" && "bg-blue-600 shadow-blue-500",
          statusConfig.variant === "gray" && "bg-gray-500 shadow-gray-400",
          className,
        )}
      >
        <div className="absolute inset-0 z-10 group-hover:bg-[linear-gradient(180deg,rgba(250,250,250,.4)_10%,transparent_60%,transparent_100%)] bg-gradient-to-r" />
        <div
          className={cn("w-full h-full absolute z-10 left-[-5]",
            "bg-[length:250%_250%,100%_100%] bg-[-100%_0] bg-no-repeat",
            statusConfig.variant === "green" && "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(150,255,208)_50%,transparent_55%,transparent_100%)]",
            statusConfig.variant === "blue" && "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(156,225,255)_50%,transparent_55%,transparent_100%)]",
            statusConfig.variant === "gray" && "group-hover:bg-[linear-gradient(140deg,transparent_45%,rgba(255,255,255)_50%,transparent_55%,transparent_100%)]",
          )}
          style={{
            animation: "shine 1.5s ease-in-out infinite",
          }}
        />

        <StatusIcon className="h-4 w-4" />
        <span className="text-sm font-semibold group-hover:opacity-0 group-hover:translate-y-full transition-all duration-500 ease-out">{statusConfig.text}</span>
      </div>
    </div>
  );
};
