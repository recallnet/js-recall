import React from "react";
import {cn} from "@recallnet/ui2/lib/utils"

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  corner?: Corner;
  cropSize?: number; // pixels
}

export const Card: React.FC<CardProps> = ({
  className,
  corner = "top-right",
  cropSize = 16,
  children,
  ...props
}) => {
  const clipPaths: Record<Corner, string> = {
    "top-left": `polygon(${cropSize}px 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${cropSize}px)`,
    "top-right": `polygon(0% 0%, calc(100% - ${cropSize}px) 0%, 100% ${cropSize}px, 100% 100%, 0% 100%)`,
    "bottom-left": `polygon(0% 0%, 100% 0%, 100% 100%, ${cropSize}px 100%, 0% calc(100% - ${cropSize}px))`,
    "bottom-right": `polygon(0% 0%, 100% 0%, 100% calc(100% - ${cropSize}px), calc(100% - ${cropSize}px) 100%, 0% 100%)`,
  };

  return (
    <div
      className={cn("relative bg-white", className)}
      style={{
        clipPath: clipPaths[corner],
        WebkitClipPath: clipPaths[corner],
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

