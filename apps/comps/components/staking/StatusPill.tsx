"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

type StatusType = "staked" | "locked" | "unstaked";

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
  const getStatusStyles = (status: StatusType): string => {
    const baseStyles =
      "rounded-xl px-4 py-2 text-xs font-bold border text-center";

    const statusStyles: Record<StatusType, string> = {
      staked: "border-gray-400 text-white",
      locked: "border-blue-700 text-blue-300",
      unstaked: "border-gray-600 text-gray-300",
    };

    return cn(baseStyles, statusStyles[status]);
  };

  return <div className={getStatusStyles(status)}>{status.toUpperCase()}</div>;
};
