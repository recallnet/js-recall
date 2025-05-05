"use client";

import React from "react";
import {cn} from "@recallnet/ui2/lib/utils"
import {Avatar, AvatarImage} from "@recallnet/ui2/components/avatar";
import Link from "next/link";

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
    <div className={cn("min-h-screen w-full flex flex-col", className)}>
      <div className="flex justify-between items-start px-6 pt-6 w-full">
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
        <div className="flex flex-col items-center mt-6 w-50">
          <span className="text-sm font-medium text-primary mb-2">GETTING STARTED</span>
          <div className="flex gap-2">
            {Array.from({length: totalSteps}).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-16 rounded-full transition-colors",
                  i <= currentStep ? "bg-blue-500" : "bg-gray-500"
                )}
              />
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center px-6 mt-10">
            {steps[currentStep]}
          </div>

        </div>
        <button onClick={onSkip} className="text-2xl font-semibold text-white cursor-pointer">
          Skip
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;

