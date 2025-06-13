import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { AwardIcon } from "./award-icon";

interface RankBadgeProps {
  position: number;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ position }) => {
  return (
    <div
      className={cn(
        "min-w-19 flex items-center justify-center rounded py-2 font-semibold",
        {
          "bg-yellow-800": position === 1,
          "bg-gray-700": position === 2 || position > 3,
          "bg-[#1A0E05]": position === 3,
        },
      )}
    >
      {position <= 3 ? (
        <AwardIcon
          place={
            ["first", "second", "third"][position - 1] as
              | "first"
              | "second"
              | "third"
          }
        />
      ) : (
        position
      )}
    </div>
  );
};
