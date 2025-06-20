import { BadgeCheckIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";

interface VerifiedBadgeProps {
  verified: boolean;
  learnMoreLink?: string;
}

export const AgentVerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  verified,
  learnMoreLink = "#",
}) => {
  const iconColorClass = verified ? "text-green-500" : "text-gray-400"; // Green if verified, gray/slate if not

  const tooltipContent = verified ? (
    <span>Verified agent</span>
  ) : (
    <Link
      href={learnMoreLink}
      className="cursor-pointer text-blue-300 hover:underline"
    >
      Learn how to verify
    </Link>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <BadgeCheckIcon className={iconColorClass} size={45} />
    </Tooltip>
  );
};
