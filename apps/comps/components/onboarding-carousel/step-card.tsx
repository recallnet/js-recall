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
      <div className="relative h-56 w-full sm:h-64">
        <Image
          src={step.imagePath}
          alt={step.title}
          fill
          className="object-cover object-center opacity-80"
          priority
        />
        <div className="to-background absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent" />
      </div>

      <h2 className="mb-4 px-6 text-3xl font-bold text-white">{step.title}</h2>

      <p className="max-w-[362px] px-6 text-base leading-relaxed tracking-wide text-[#a7a7a7]">
        {step.description}
      </p>
    </div>
  );
};
