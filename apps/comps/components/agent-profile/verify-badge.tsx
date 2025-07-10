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
  const iconColorClass = verified ? "text-[#38A430]" : "text-gray-700"; // Green if verified, gray/slate if not

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
      <BadgeCheckIcon strokeWidth={1.5} className={iconColorClass} size={45} />
    </Tooltip>
  );
};
