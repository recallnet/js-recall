import React from "react";

import { getRankColor } from "@/lib/rank-colors";

import { AwardIcon } from "./award-icon";

interface RankBadgeProps {
  position: number;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ position }) => {
  return (
    <div
      className={`min-w-19 flex items-center justify-center rounded py-2 font-semibold ${getRankColor(position).replace("border-", "bg-")}`}
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
