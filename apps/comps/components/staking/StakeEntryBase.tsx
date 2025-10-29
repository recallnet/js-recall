"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Spinner } from "@recallnet/ui2/components/spinner";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { BoostIcon } from "../BoostIcon";
import { Recall } from "../Recall";
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
    <div className="xs:p-4 rounded-lg border border-[#212C3A] bg-gray-900 p-3 transition-colors hover:bg-gray-800">
      <div className="flex flex-col items-stretch justify-between">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <StatusPill status={status} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-4">
                <Recall size="md" />
                <span className="text-lg font-semibold text-white">
                  {formattedAmount}
                </span>
              </div>
              <div className="hidden text-gray-400 sm:block">
                <ArrowRightIcon />
              </div>
              <div className="flex items-center gap-1 text-yellow-400">
                <BoostIcon />
                <span className="font-bold">{boostAmount}</span>
                <span className="text-gray-400">per competition.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant ?? "outline"}
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
      </div>

      {progress && (
        <div className="mt-4 flex items-center justify-between gap-8 text-sm text-gray-400">
          <Tooltip content={progress.leftLabelTooltip}>
            <span className="cursor-help">{progress.leftLabel}</span>
          </Tooltip>
          <div className="xs:flex hidden max-w-md flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full bg-[#6D85A4] transition-all duration-300"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <span className="text-primary-foreground">
              {progress.progressText}
            </span>
          </div>
          <Tooltip content={progress.rightLabelTooltip} className="text-right">
            <span className="cursor-help">{progress.rightLabel}</span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
