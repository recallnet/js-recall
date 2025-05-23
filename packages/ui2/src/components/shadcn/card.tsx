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
  style,
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
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

interface BorderCardProps extends Omit<CardProps, "width" | "height"> {
  width: number;
  height: number;
  xlWidth?: number;
  xlHeight?: number;
  mdWidth?: number;
  mdHeight?: number;
  borderColor: string; // e.g., "gray-600"
  inset?: number;
  children?: React.ReactNode;
}

export const BorderCard: React.FC<BorderCardProps> = ({
  width,
  height,
  xlWidth,
  xlHeight,
  mdWidth,
  mdHeight,
  borderColor,
  inset = 2,
  children,
  className,
  ...rest
}) => {
  const outerStyle: React.CSSProperties = {
    width,
    height,
  };

  const innerStyle: React.CSSProperties = {
    width: width - inset,
    height: height - inset,
  };

  return (
    <Card
      className={cn("flex items-center justify-center", `bg-${borderColor}`)}
      style={outerStyle}
      {...rest}
    >
      <Card
        className={cn("relative", className)}
        style={innerStyle}
        {...rest}
      >
        {children}
      </Card>
    </Card>
  );
};
