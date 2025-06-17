"use client";

import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { Competition } from "@/types";

import CountdownClock from "./clock";
import { getCompetitionVotingConfig } from "./competition-voting-config";

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

  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate height based on scroll position
  // Full height at scroll 0, minimum 5px at scroll 200px or more
  const maxHeight = 80; // py-4 vs py-3
  const minHeight = 8;
  const scrollThreshold = 200;

  const currentHeight = Math.max(
    minHeight,
    maxHeight - (scrollY / scrollThreshold) * (maxHeight - minHeight),
  );

  // Calculate opacity for content based on height
  const contentOpacity = Math.max(
    0,
    (currentHeight - minHeight) / (maxHeight - minHeight),
  );
  const showContent = contentOpacity > 0.1;

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
        "sticky top-0 z-50 flex items-center justify-start gap-3 overflow-hidden px-24 text-white shadow-lg transition-all duration-200 ease-out",
        "ml-[calc(-50vw+50%)] w-screen",
        config.variant === "green" && "bg-green-600",
        config.variant === "blue" && "bg-blue-600",
        config.variant === "gray" && "bg-gray-600",
        className,
      )}
      style={{
        height: `${currentHeight}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      <div
        className={cn(
          "flex gap-3 transition-opacity duration-200",
          showContent && "flex-col",
        )}
        style={{ opacity: contentOpacity }}
      >
        <div className="flex gap-3">
          {showContent && config.subTitle && (
            <span className="text-md font-medium opacity-90">
              {config.subTitle}
            </span>
          )}
          {showContent && config.description && (
            <span className="text-md max-w-2xl opacity-80">
              {config.description}
            </span>
          )}
          {showContent && config.untilTime && (
            <span className="max-w-2xl opacity-80">
              <CountdownClock
                className="text-md"
                showDuration={true}
                targetDate={config.untilTime}
              />
            </span>
          )}
        </div>
      </div>

      <div
        className="absolute right-24 top-1/2 -translate-y-1/2"
        style={{ opacity: contentOpacity }}
      >
        <span
          className={cn(
            "text-md font-medium transition-opacity duration-200",
            showContent ? "opacity-90" : "opacity-40",
          )}
        >
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

      <button
        onClick={handleClose}
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition-all duration-200 hover:bg-white/20",
          showContent ? "opacity-80" : "opacity-60",
        )}
        aria-label="Close banner"
      >
        <X
          className={cn(
            "transition-all duration-200",
            showContent ? "h-4 w-4" : "h-3 w-3",
          )}
        />
      </button>
    </div>
  );
};
