import React from "react";

import { AwardIcon } from "./award-icon";

interface RankBadgeProps {
  position: number;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ position }) => {
  const getBackgroundColor = () => {
    switch (position) {
      case 1:
        return "bg-yellow-800";
      case 2:
        return "bg-gray-700";
      case 3:
        return "bg-[#1A0E05]";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <div
      className={`min-w-19 flex items-center justify-center rounded py-2 font-semibold ${getBackgroundColor()}`}
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
