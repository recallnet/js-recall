import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { AwardIcon } from "./award-icon";

interface RankBadgeProps {
  rank: number;
  className?: string;
  showIcon?: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  rank,
  className,
  showIcon = true,
}) => {
  return (
    <div
      className={cn(
        "min-w-19 flex items-center justify-center rounded py-2 font-semibold",
        {
          "bg-trophy-first-bg": rank === 1,
          "bg-trophy-second-bg": rank === 2,
          "bg-trophy-third-bg": rank === 3,
          "bg-gray-700": rank > 3,
        },
        className,
      )}
    >
      {showIcon && rank <= 3 ? (
        <AwardIcon
          place={
            ["first", "second", "third"][rank - 1] as
              | "first"
              | "second"
              | "third"
          }
        />
      ) : (
        rank
      )}
    </div>
  );
};
