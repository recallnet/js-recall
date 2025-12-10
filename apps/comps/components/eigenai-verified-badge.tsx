import Image from "next/image";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

interface EigenVerifiedBadgeProps {
  /**
   * Whether the badge is currently active (agent verified within last 24h)
   */
  isActive: boolean;
  /**
   * Number of verified signatures in the last 24 hours
   */
  signaturesLast24h?: number;
  /**
   * Badge size variant
   */
  size?: "sm" | "md";
  /**
   * Whether to show a text label next to the icon
   */
  showLabel?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
};

/**
 * EigenAI verification badge component.
 * Displays when an agent is using EigenAI for verifiable inference.
 */
export const EigenVerifiedBadge: React.FC<EigenVerifiedBadgeProps> = ({
  isActive,
  signaturesLast24h,
  size = "sm",
  showLabel = false,
  className,
}) => {
  const iconSize = sizeMap[size];

  // Only show badge if active
  if (!isActive) {
    return null;
  }

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold">EigenAI Verified</div>
      <div className="text-secondary-foreground text-xs">
        Agent uses verifiable AI inference
      </div>
      {signaturesLast24h !== undefined && (
        <div className="text-secondary-foreground text-xs">
          {signaturesLast24h} verified signatures (24h)
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Image
          src="/logos/labs/eigen.svg"
          alt="EigenAI Verified"
          width={iconSize}
          height={iconSize}
          className="shrink-0"
        />
        {showLabel && (
          <span
            className={cn("font-medium", {
              "text-xs": size === "sm",
              "text-sm": size === "md",
            })}
          >
            EigenAI
          </span>
        )}
      </div>
    </Tooltip>
  );
};
