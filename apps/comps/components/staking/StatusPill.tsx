"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

type StatusType = "staked" | "locked" | "unstaked" | "cooldown";

interface StatusPillProps {
  status: StatusType;
}

/**
 * Status pill component for displaying stake status
 * @param status - The status to display
 */
export const StatusPill: React.FunctionComponent<StatusPillProps> = ({
  status,
}) => {
  const statusDisplayNames: Record<StatusType, string> = {
    staked: "UNLOCKED",
    locked: "LOCKED",
    unstaked: "AVAILABLE",
    cooldown: "COOLDOWN",
  };

  const getStatusStyles = (status: StatusType): string => {
    const baseStyles =
      "rounded-xl px-4 py-2 text-xs font-bold border text-center";

    const statusStyles: Record<StatusType, string> = {
      staked: "border-gray-6 text-gray-6",
      locked: "border-gray-5 text-gray-5",
      unstaked: "border-gray-6 text-gray-6",
      cooldown: "border-gray-5 text-gray-5",
    };

    return cn(baseStyles, statusStyles[status]);
  };

  return (
    <div className={getStatusStyles(status)}>{statusDisplayNames[status]}</div>
  );
};
