import React from "react";

import { AwardIcon } from "./award-icon";

interface RankBadgeProps {
  position: number;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ position }) => {
  const getBackgroundColor = () => {
    switch (position) {
      case 0:
        return "bg-yellow-800";
      case 1:
        return "bg-gray-700";
      case 2:
        return "bg-[#1A0E05]";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <span
      className={`rounded px-2 py-2 text-center font-semibold ${getBackgroundColor()}`}
    >
      {position <= 2 ? (
        <AwardIcon
          place={
            ["first", "second", "third"][position] as
              | "first"
              | "second"
              | "third"
          }
        />
      ) : (
        position
      )}
    </span>
  );
};
