"use client";

import "./competition-voting-banner.css";

import { X } from "lucide-react";
import React, { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { Competition } from "@/types";

import CountdownClock from "./clock";
import { getCompetitionVotingConfig } from "./competition-voting-config";

/**
 * CompetitionVotingBanner uses a CSS-only shrinking header technique.
 *
 * How it works:
 * 1. Outer container has a larger height (80px) and negative top positioning (-48px)
 * 2. Inner container has a smaller height (32px) and top: 0
 * 3. As user scrolls, the outer container slides up due to negative top value
 * 4. Inner container sticks to viewport top, creating shrinking effect
 * 5. The difference (80px - 32px = 48px) determines shrink amount
 *
 * This eliminates the need for JavaScript scroll listeners and provides
 * better performance than the previous implementation.
 */

export interface CompetitionVotingBannerProps {
  competition: Competition;
  className?: string;
  onClose?: () => void;
}

export const CompetitionVotingBanner: React.FC<
  CompetitionVotingBannerProps
> = ({ competition, className, onClose }) => {
  const config = getCompetitionVotingConfig(
    competition,
    competition.userVotingInfo?.info?.hasVoted || false,
  );

  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "competition-voting-banner-outer",
        config.variant === "green" && "competition-voting-banner-green",
        config.variant === "blue" && "competition-voting-banner-blue",
        config.variant === "gray" && "competition-voting-banner-gray",
        className,
      )}
      style={{
        height: "80px", // Full height - this is what the banner starts at
        top: "-48px", // Negative top = inner height - outer height = 32px - 80px = -48px
        // This makes the outer container slide "above" the viewport as user scrolls
      }}
    >
      <div
        className="competition-voting-banner-inner"
        style={{
          height: "32px", // Shrunk height - this is the final collapsed state
          top: "0", // Sticks to top of viewport when outer container slides up
        }}
      >
        {/* Content that appears in full height */}
        <div className="competition-voting-banner-content">
          {config.subTitle && (
            <span className="competition-voting-banner-text text-md font-medium opacity-90">
              {config.subTitle}
            </span>
          )}
          {config.description && (
            <span className="competition-voting-banner-text text-md max-w-2xl opacity-80">
              {config.description}
            </span>
          )}
          {config.untilTime && (
            <span className="competition-voting-banner-text max-w-2xl opacity-80">
              <CountdownClock
                className="text-md"
                showDuration={true}
                targetDate={config.untilTime}
              />
            </span>
          )}
        </div>

        {/* Phase indicator - positioned absolutely */}
        <div className="competition-voting-banner-phase">
          <span className="text-md">
            Phase:{" "}
            <span
              className={cn(
                "pl-4 opacity-60",
                config.phase === "registration" && "font-bold opacity-100",
              )}
            >
              Registration
            </span>{" "}
            <span
              className={cn(
                "pl-4 opacity-60",
                config.phase === "voting" && "font-bold opacity-100",
              )}
            >
              Voting
            </span>
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="competition-voting-banner-close"
          aria-label="Close banner"
        >
          <X className="competition-voting-banner-close-icon" />
        </button>
      </div>
    </div>
  );
};
