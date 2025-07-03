"use client";

import { Eye, EyeOff } from "lucide-react";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

type VisibilityToggleProps = {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
  tooltipContent?: {
    visible: string;
    hidden: string;
  };
};

export function VisibilityToggle({
  isVisible,
  onToggle,
  className,
  tooltipContent = {
    visible: "Hide",
    hidden: "Show",
  },
}: VisibilityToggleProps) {
  return (
    <Tooltip
      content={isVisible ? tooltipContent.visible : tooltipContent.hidden}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "text-secondary-foreground hover:text-primary-foreground flex-shrink-0 cursor-pointer rounded-md p-1.5",
          className,
        )}
      >
        {isVisible ? (
          <Eye className="h-5 w-5" />
        ) : (
          <EyeOff className="h-5 w-5" />
        )}
      </button>
    </Tooltip>
  );
}
