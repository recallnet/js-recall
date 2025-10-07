import { SquarePen } from "lucide-react";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

interface EditButtonProps {
  /**
   * Click handler for the edit button
   */
  onClick?: () => void;
  /**
   * Optional tooltip content
   * @default "Edit"
   */
  tooltipContent?: string;
  /**
   * Optional class name for the wrapper div
   */
  className?: string;
  /**
   * Optional class name for the icon
   */
  iconClassName?: string;
  /**
   * Optional size for the icon
   * @default 18
   */
  size?: number;
  /**
   * Optional aria-label for accessibility
   * @default "Edit"
   */
  ariaLabel?: string;
}

/**
 * Reusable edit button component with tooltip
 */
export const EditButton: React.FC<EditButtonProps> = ({
  onClick,
  tooltipContent = "Edit",
  className,
  iconClassName,
  size = 18,
  ariaLabel = "Edit",
}) => {
  return (
    <Tooltip content={tooltipContent}>
      <div
        className={cn("cursor-pointer p-1", className)}
        onClick={onClick}
        role="button"
        tabIndex={onClick ? 0 : undefined}
        aria-label={ariaLabel}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <SquarePen
          className={cn("text-secondary-foreground", iconClassName)}
          size={size}
        />
      </div>
    </Tooltip>
  );
};
