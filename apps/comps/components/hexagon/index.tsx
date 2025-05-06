import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

type HexagonProps = React.HTMLAttributes<HTMLDivElement>;

export const Hexagon: React.FC<HexagonProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "h-13 w-13 flex items-center justify-center text-white",
        className,
      )}
      style={{
        clipPath:
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        WebkitClipPath:
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        transform: "rotate(90deg)",
      }}
      {...props}
    >
      <div className="rotate-[-90deg]">{children}</div>
    </div>
  );
};
