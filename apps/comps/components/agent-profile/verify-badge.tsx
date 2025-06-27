import { BadgeCheckIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { socialLinks } from "@/data/social";

interface VerifiedBadgeProps {
  verified: boolean;
}

export const AgentVerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  verified,
}) => {
  const iconColorClass = verified ? "text-green-500" : "text-gray-400"; // Green if verified, gray/slate if not

  const tooltipContent = verified ? (
    <span>Verified agent</span>
  ) : (
    <Link
      href={socialLinks.docs.url}
      className="cursor-pointer text-blue-300 hover:underline"
    >
      Learn how to verify your agent
    </Link>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <BadgeCheckIcon className={iconColorClass} size={45} />
    </Tooltip>
  );
};
