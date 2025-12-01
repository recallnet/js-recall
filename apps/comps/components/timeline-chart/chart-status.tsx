"use client";

import { isFuture } from "date-fns";
import { useRouter } from "next/navigation";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { CountdownClock } from "@/components/clock";
import { formatDateShort } from "@/utils/format";

interface ChartStatusProps {
  status: string;
  startDate?: Date | null;
  boostStartDate?: Date | null;
  hasData: boolean;
  className?: string;
}

export function ChartStatus({
  status,
  startDate,
  boostStartDate,
  hasData,
  className,
}: ChartStatusProps) {
  const router = useRouter();

  // Show countdown for pending competitions
  if (status === "pending") {
    // No start date - show placeholder message
    if (!startDate) {
      return (
        <div
          className={cn(
            "h-150 flex w-full flex-col items-center justify-center",
            className,
          )}
        >
          <div className="flex w-full max-w-2xl flex-col items-center justify-center space-y-8 px-8 py-16 text-center">
            <div className="space-y-4">
              <h2 className="text-primary-foreground text-3xl font-semibold tracking-wide">
                Competition Details Pending
              </h2>
            </div>
            <p className="text-secondary-foreground text-lg">
              Check back soon for the competition&apos;s start time,
              requirements, and boosting details.
            </p>
          </div>
        </div>
      );
    }

    // Start date exists - show countdown(s) for competition and boosting
    const showCompetitionCountdown = isFuture(startDate);
    const showBoostingCountdown = boostStartDate && isFuture(boostStartDate);
    const showBothCountdowns =
      showCompetitionCountdown && showBoostingCountdown;

    return (
      <div
        className={cn(
          "h-150 flex w-full flex-col items-center justify-center",
          className,
        )}
      >
        <div className="flex w-full max-w-7xl flex-col items-center justify-center px-4 py-16">
          {/* Show countdown(s) side by side if both exist, otherwise centered */}
          {(showCompetitionCountdown || showBoostingCountdown) && (
            <div
              className={`grid w-full ${
                showBothCountdowns
                  ? "relative grid-cols-1 gap-16 sm:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {/* Boost start countdown */}
              {showBoostingCountdown && (
                <div className="flex flex-col items-center space-y-8 text-center">
                  <div className="space-y-2">
                    <h2 className="text-primary-foreground text-3xl font-semibold uppercase tracking-wide">
                      Boosting Opens In
                    </h2>
                  </div>
                  <CountdownClock
                    targetDate={boostStartDate}
                    className="text-primary text-6xl font-bold"
                    showDuration={true}
                    onFinish={() => {
                      router.refresh();
                    }}
                  />
                  <p className="text-secondary-foreground max-w-sm text-lg">
                    Boosting opens on {formatDateShort(boostStartDate)}. Predict
                    the top agents to earn rewards.
                  </p>
                </div>
              )}

              {/* Centered divider between columns */}
              {showBothCountdowns && (
                <div className="bg-border absolute left-1/2 top-0 hidden h-full w-px sm:block"></div>
              )}

              {/* Competition start countdown */}
              {showCompetitionCountdown && (
                <div className="flex flex-col items-center space-y-8 text-center">
                  <div className="space-y-2">
                    <h2 className="text-primary-foreground text-3xl font-semibold uppercase tracking-wide">
                      Competition Starts In
                    </h2>
                  </div>
                  <CountdownClock
                    targetDate={startDate}
                    className="text-primary text-6xl font-bold"
                    showDuration={true}
                    onFinish={() => {
                      router.refresh();
                    }}
                  />
                  <p className="text-secondary-foreground max-w-sm text-lg">
                    Agents will begin competing on {formatDateShort(startDate)}{" "}
                    to prove their skills.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Edge case where both dates are in the past (shouldn't happen, unless a competition wasn't properly started) */}
          {!showCompetitionCountdown && !showBoostingCountdown && (
            <div className="flex w-full max-w-2xl flex-col items-center justify-center space-y-8 px-8 py-16 text-center">
              <div className="space-y-4">
                <h2 className="text-primary-foreground text-3xl font-semibold tracking-wide">
                  Competition Will Begin Shortly
                </h2>
                <p className="text-secondary-foreground text-lg">
                  Check back soon to see how agents are performing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edge case where the competition is active but no data is available yet
  if (!hasData) {
    return (
      <div
        className={cn(
          "h-150 flex w-full flex-col items-center justify-center",
          className,
        )}
      >
        <div className="flex w-full max-w-2xl flex-col items-center justify-center space-y-8 px-8 py-16 text-center">
          <div className="space-y-4">
            <h2 className="text-primary-foreground text-3xl font-semibold tracking-wide">
              Waiting for Data
            </h2>
            <p className="text-secondary-foreground text-lg">
              Agents are getting ready. Performance metrics will appear shortly.
            </p>
          </div>
          <div className="text-primary flex items-center space-x-2">
            <div className="bg-primary h-2 w-2 animate-pulse rounded-full"></div>
            <div
              className="bg-primary h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="bg-primary h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
