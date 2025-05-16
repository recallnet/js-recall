import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface AwardIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  place: "first" | "second" | "third";
}

export const AwardIcon: React.FunctionComponent<AwardIconProps> = ({
  height = "1em",
  strokeWidth = "2",
  fill = "none",
  focusable = "false",
  place,
  className,
  ...props
}) => {
  const text = place === "first" ? "1ST" : place === "second" ? "2ND" : "3RD";

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
      <span className="mb-1 text-center text-lg">
        <svg
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          height={height}
          focusable={focusable}
          {...props}
        >
          <g
            fill={fill}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          >
            <path d="M6 9a6 6 0 1 0 12 0A6 6 0 1 0 6 9" />
            <path d="m12 15l3.4 5.89l1.598-3.233l3.598.232l-3.4-5.889M6.802 12l-3.4 5.89L7 17.657l1.598 3.232l3.4-5.889" />
          </g>
        </svg>
      </span>
      <span className="mb-1 text-center text-xs">{text}</span>
    </div>
  );
};

export default AwardIcon;
