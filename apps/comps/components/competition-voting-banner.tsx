"use client";

import { X } from "lucide-react";
import React, { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { Competition, CompetitionStatus } from "@/types";

import CountdownClock from "./clock";
import { getCompetitionStateConfig } from "./competition-state-config";

export interface CompetitionVotingBannerProps {
  competition: Competition;
  className?: string;
  onClose?: () => void;
}

export const CompetitionVotingBanner: React.FC<
  CompetitionVotingBannerProps
> = ({ competition, className, onClose }) => {
  const config = getCompetitionStateConfig(
    competition,
    competition.userVotingInfo?.info?.hasVoted || false,
  );
  const [displayConfig, setDisplayConfig] = useState(config);

  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const countdownFinished = () => {
    const config = getCompetitionStateConfig(
      competition,
      competition.userVotingInfo?.info?.hasVoted || false,
    );
    setDisplayConfig(config);
  };

  if (!isVisible || competition.status === CompetitionStatus.Ended) {
    return null;
  }

  return (
    <div
      className={cn(
        // Base styling for outer container
        "sticky z-50 flex transform-gpu items-center justify-start overflow-hidden shadow-lg will-change-transform",
        // Full-width positioning using negative margins
        "ml-[calc(-50vw+50%)] w-screen",
        // Color variants
        displayConfig.variant === "green" && "bg-green-600",
        displayConfig.variant === "blue" && "bg-blue-600",
        displayConfig.variant === "gray" && "bg-gray-600",
        className,
      )}
      style={{
        height: "80px", // Full height - this is what the banner starts at
        top: "-72px", // Negative top = inner height - outer height = 8px - 80px = -72px
        // This makes the outer container slide "above" the viewport as user scrolls
      }}
    >
      <div
        className="sticky top-0 flex w-full transform-gpu items-center justify-start gap-3 px-4 text-white transition-all duration-200 ease-out will-change-transform sm:px-24"
        style={{
          height: "8px", // Shrunk height - this is the final collapsed state
          top: "0", // Sticks to top of viewport when outer container slides up
        }}
      >
        {/* Content that appears in full height */}
        <div className="flex flex-1 gap-3 overflow-hidden">
          {displayConfig.subTitle && (
            <span className="text-md overflow-hidden text-ellipsis whitespace-nowrap font-medium opacity-90 transition-opacity duration-150 ease-out">
              {displayConfig.subTitle}
            </span>
          )}
          {displayConfig.description && (
            <span className="text-md max-w-2xl overflow-hidden text-ellipsis whitespace-nowrap opacity-80 transition-opacity duration-150 ease-out">
              {displayConfig.description}
            </span>
          )}
          {displayConfig.untilTime && (
            <span className="max-w-2xl overflow-hidden text-ellipsis whitespace-nowrap opacity-80 transition-opacity duration-150 ease-out">
              <CountdownClock
                className="text-md"
                showDuration={true}
                targetDate={displayConfig.untilTime}
                onFinish={countdownFinished}
              />
            </span>
          )}
        </div>

        {/* Phase indicator - hidden on small screens */}
        <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 whitespace-nowrap font-medium opacity-90 sm:right-24 sm:block">
          <span className="text-md">
            Phase:{" "}
            <span
              className={cn(
                "pl-4 opacity-60",
                displayConfig.phase === "registration" &&
                  "font-bold opacity-100",
              )}
            >
              Registration
            </span>{" "}
            <span
              className={cn(
                "pl-4 opacity-60",
                displayConfig.phase === "voting" && "font-bold opacity-100",
              )}
            >
              Voting
            </span>
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 transform-gpu rounded-full p-1 opacity-80 transition-all duration-150 ease-out hover:bg-white/20"
          aria-label="Close banner"
        >
          <X className="h-4 w-4 transition-transform duration-150 ease-out" />
        </button>
      </div>
    </div>
  );
};
