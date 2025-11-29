"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import React from "react";

import { Spinner } from "@recallnet/ui2/components/spinner";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { BoostIcon } from "../BoostIcon";
import { Recall } from "../Recall";
import { Button } from "./Button";
import { StatusPill } from "./StatusPill";

/**
 * Props for stake entry action buttons
 */
export interface StakeEntryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "outline";
  isLoading?: boolean;
  loadingLabel?: string;
}

/**
 * Props for stake entry progress footer
 */
export interface StakeEntryProgress {
  leftLabel: string;
  leftLabelTooltip: string;
  rightLabel: string;
  rightLabelTooltip: string;
  progressPercent: number;
  progressText: string;
}

/**
 * Props for StakeEntryBase component
 */
export interface StakeEntryBaseProps {
  status: "staked" | "locked" | "unstaked" | "cooldown";
  formattedAmount: string;
  boostAmount: string;
  actions: StakeEntryAction[];
  progress?: StakeEntryProgress;
}

/**
 * Shared presentational component for stake entry cards
 * @param status - Status pill text
 * @param formattedAmount - Formatted stake amount
 * @param boostAmount - Formatted boost amount
 * @param actions - Action buttons to display
 * @param progress - Optional progress bar configuration
 */
export const StakeEntryBase: React.FunctionComponent<StakeEntryBaseProps> = ({
  status,
  formattedAmount,
  boostAmount,
  actions,
  progress,
}) => {
  return (
    <div className="xs:p-4 border-gray-4 bg-gray-2 rounded-lg border p-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 sm:w-auto sm:gap-4">
          <StatusPill status={status} />
          <div className="flex min-w-0 flex-row items-center gap-2 sm:gap-4">
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <Recall size="md" />
              <span className="whitespace-nowrap text-lg font-semibold text-white">
                {formattedAmount}
              </span>
            </div>
            <div className="text-gray-6 shrink-0">
              <ArrowRightIcon />
            </div>
            <div className="flex shrink-0 items-center gap-1 text-yellow-400">
              <BoostIcon />
              <span className="font-bold">{boostAmount}</span>
              <span className="text-gray-6 hidden sm:inline">
                per competition.
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-row gap-2 sm:shrink-0">
          {actions.map((action, index) => (
            <Button
              key={index}
              disabled={Boolean(action.disabled || action.isLoading)}
              onClick={action.onClick}
            >
              {action.isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  {action.loadingLabel ?? action.label}
                </span>
              ) : (
                action.label
              )}
            </Button>
          ))}
        </div>
      </div>

      {progress && (
        <div className="text-gray-6 mt-4 flex flex-row items-center justify-between gap-2 text-sm">
          <Tooltip content={progress.leftLabelTooltip}>
            <span className="shrink-0 cursor-help text-xs sm:text-sm">
              {progress.leftLabel}
            </span>
          </Tooltip>
          <div className="mx-1 hidden min-w-0 flex-1 items-center gap-2 sm:mx-2 sm:flex">
            <div className="bg-gray-3 h-2 min-w-0 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-gray-5 h-full transition-all duration-300"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <span className="text-gray-6 shrink-0 whitespace-nowrap text-xs sm:text-sm">
              {progress.progressText}
            </span>
          </div>
          <Tooltip
            content={progress.rightLabelTooltip}
            className="shrink-0 text-right"
          >
            <span className="cursor-help text-xs sm:text-sm">
              {progress.rightLabel}
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
