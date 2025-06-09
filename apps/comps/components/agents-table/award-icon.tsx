import { Award, Trophy } from "lucide-react";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface AwardIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  place: "first" | "second" | "third";
}

export const AwardIcon: React.FunctionComponent<AwardIconProps> = ({
  height = "1em",
  focusable = "false",
  place,
  className,
  ...props
}) => {
  const text = place === "first" ? "1st" : place === "second" ? "2nd" : "3rd";

  return (
    <div
      className={cn(
        "flex items-center font-semibold text-gray-400",
        className,
        {
          "text-yellow-400": place === "first",
          "text-gray-400": place === "second",
          "text-red-400": place === "third",
        },
      )}
    >
      <span className="text-center text-lg">
        {place === "first" ? (
          <Trophy role="img" height={height} focusable={focusable} {...props} />
        ) : (
          <Award role="img" height={height} focusable={focusable} {...props} />
        )}
      </span>
      <span>{text}</span>
    </div>
  );
};

export default AwardIcon;
