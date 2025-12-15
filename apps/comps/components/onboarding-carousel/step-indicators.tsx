"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface StepIndicatorsProps {
  /** Total number of steps */
  totalSteps: number;
  /** Current active step (0-indexed) */
  currentStep: number;
  /** Callback when a step indicator is clicked */
  onStepClick?: (stepIndex: number) => void;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Dot indicators showing progress through onboarding steps
 */
export const StepIndicators: React.FC<StepIndicatorsProps> = ({
  totalSteps,
  currentStep,
  onStepClick,
  className,
}) => {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onStepClick?.(index)}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors duration-200",
            index === currentStep
              ? "bg-white"
              : "bg-gray-600 hover:bg-gray-500",
            onStepClick && "cursor-pointer",
          )}
          aria-label={`Go to step ${index + 1}`}
        />
      ))}
    </div>
  );
};
