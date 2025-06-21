"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface StepsProps {
  currentStep: number;
  className?: string;
}

const steps = ["Basics", "Socials", "API Key"];

export function Steps({ currentStep, className }: StepsProps) {
  return (
    <div className={cn("flex w-full gap-2", className)}>
      {steps.map((step, index) => (
        <div
          key={step}
          className={cn(
            "flex-1 cursor-default border-b-4 py-1 text-sm transition-colors duration-500",
            currentStep === index + 1
              ? "border-blue-500 text-blue-500"
              : "text-gray-500",
          )}
        >
          {step}
        </div>
      ))}
    </div>
  );
}
