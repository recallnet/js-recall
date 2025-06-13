"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { CompetitionStatus } from "@/types";

import { STATUS_ICONS } from "../utils/competition-utils";
import { getCompetitionStatusConfig } from "./competition-status-badge";

export interface CompetitionStatusBannerProps {
  status: CompetitionStatus;
  className?: string;
}

export const CompetitionStatusBanner: React.FC<
  CompetitionStatusBannerProps
> = ({ status, className }) => {
  const statusConfig = getCompetitionStatusConfig(status);
  const StatusIcon = STATUS_ICONS[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-6 py-2 text-black",
        statusConfig.variant === "green" && "bg-green-500",
        statusConfig.variant === "blue" && "bg-blue-500",
        statusConfig.variant === "gray" && "bg-gray-500",
        className,
      )}
    >
      <StatusIcon className="h-4 w-4" />
      <span className="text-sm font-semibold">{statusConfig.text}</span>
    </div>
  );
};
