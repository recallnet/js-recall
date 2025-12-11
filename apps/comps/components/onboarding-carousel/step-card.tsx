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
      <div className="relative mb-6 h-56 w-full overflow-hidden">
        <Image
          src={step.imagePath}
          alt={step.title}
          fill
          className="object-contain"
          priority
          sizes="(max-width: 400px) 100vw, 400px"
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
