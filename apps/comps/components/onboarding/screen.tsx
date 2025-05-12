"use client";

import Link from "next/link";
import React from "react";

import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";
import { cn } from "@recallnet/ui2/lib/utils";

interface OnboardingScreenProps {
  steps: React.ReactNode[];
  currentStep: number;
  onSkip?: () => void;
  className?: string;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  steps,
  currentStep,
  onSkip,
  className,
}) => {
  const totalSteps = steps.length;

  return (
    <div className={cn("flex min-h-screen w-full flex-col", className)}>
      <div className="flex w-full items-start justify-between px-6 pt-6">
        <Link href="/" className="flex items-center">
          <Avatar className="h-12 w-12">
            {" "}
            <AvatarImage
              src="/favicon-32x32.png"
              alt="recallnet"
              className="w-12"
            />
          </Avatar>
        </Link>
        <div className="mt-6 flex w-full flex-col items-center">
          <span className="text-primary mb-2 text-sm font-medium">
            GETTING STARTED
          </span>
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-16 rounded-full transition-colors",
                  i <= currentStep ? "bg-blue-500" : "bg-gray-500",
                )}
              />
            ))}
          </div>

          <div className="flex w-full flex-1 items-center justify-center">
            {steps[currentStep]}
          </div>
        </div>
        {currentStep < totalSteps - 1 && (
          <button
            onClick={onSkip}
            className="cursor-pointer text-2xl font-semibold text-white"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
