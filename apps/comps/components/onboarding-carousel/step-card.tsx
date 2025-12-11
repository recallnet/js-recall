"use client";

import Image from "next/image";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { OnboardingStep } from "./steps";

interface StepCardProps {
  /** Step data to display */
  step: OnboardingStep;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Individual step card displaying image, title, and description
 */
export const StepCard: React.FC<StepCardProps> = ({ step, className }) => {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <div className="mb-6 flex h-56 w-full items-center justify-center">
        <Image
          src={step.imagePath}
          alt={step.title}
          width={224}
          height={224}
          className="h-auto max-h-56 w-auto"
          priority
        />
      </div>

      <h2 className="mb-4 text-2xl font-bold italic text-white">
        {step.title}
      </h2>

      <p className="max-w-xs text-sm leading-relaxed text-gray-400">
        {step.description}
      </p>
    </div>
  );
};
