"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  tooltipClassName?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  className = "",
  tooltipClassName = "",
}) => {
  return (
    <RadixTooltip.Provider delayDuration={100}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span className={className}>{children}</span>
        </RadixTooltip.Trigger>

        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={position}
            sideOffset={8}
            className={cn(
              "z-50 max-w-xs rounded-xl bg-gray-900 px-3 py-2 text-sm text-white shadow-[0_8px_30px_rgb(0,0,0,0.6)] transition-all duration-200 ease-in-out",
              tooltipClassName,
            )}
          >
            {content}
            <RadixTooltip.Arrow
              className="fill-gray-900"
              width="25"
              height="10"
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

export default Tooltip;
