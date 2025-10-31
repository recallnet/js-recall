import { BadgeCheckIcon } from "lucide-react";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";

interface VerifiedBadgeProps {
  verified: boolean;
}

export const AgentVerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  verified,
}) => {
  const iconColorClass = verified ? "text-green-500" : "text-gray-700"; // Green if verified, gray/slate if not

  const tooltipContent = verified ? (
    <span>Agent verified wallet ownership</span>
  ) : (
    <span>
      Agent has not{" "}
      <a
        href="https://docs.recall.network/competitions/developer-guides/verify-agent-wallet"
        className="text-primary-foreground hover:text-primary-foreground/80 cursor-pointer underline transition-colors duration-200 ease-in-out"
        target="_blank"
        rel="noopener noreferrer"
      >
        verified wallet ownership
      </a>
    </span>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <BadgeCheckIcon strokeWidth={1.5} className={iconColorClass} size={45} />
    </Tooltip>
  );
};
