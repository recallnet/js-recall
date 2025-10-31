import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  corner?: Corner | Corner[];
  cropSize?: number | number[]; // pixels
}

export const Card: React.FC<CardProps> = ({
  className,
  corner = "top-right",
  cropSize = 16,
  children,
  style,
  ...props
}) => {
  // Normalize inputs for backward compatibility
  const corners = Array.isArray(corner) ? corner : [corner];
  const cropSizes = Array.isArray(cropSize) ? cropSize : [cropSize];

  // Create a map of corner to its crop size
  const cornerCropMap: Record<Corner, number> = {
    "top-left": 0,
    "top-right": 0,
    "bottom-left": 0,
    "bottom-right": 0,
  };

  // Apply crop sizes to specified corners
  corners.forEach((c, index) => {
    cornerCropMap[c] = cropSizes[index] || cropSizes[0] || 16;
  });

  // Generate clip path based on all corners
  const generateClipPath = () => {
    const tl = cornerCropMap["top-left"];
    const tr = cornerCropMap["top-right"];
    const bl = cornerCropMap["bottom-left"];
    const br = cornerCropMap["bottom-right"];

    const points = [];

    // Top-left corner
    if (tl > 0) {
      points.push(`${tl}px 0%`);
    } else {
      points.push(`0% 0%`);
    }

    // Top-right corner
    if (tr > 0) {
      points.push(`calc(100% - ${tr}px) 0%`);
      points.push(`100% ${tr}px`);
    } else {
      points.push(`100% 0%`);
    }

    // Bottom-right corner
    if (br > 0) {
      points.push(`100% calc(100% - ${br}px)`);
      points.push(`calc(100% - ${br}px) 100%`);
    } else {
      points.push(`100% 100%`);
    }

    // Bottom-left corner
    if (bl > 0) {
      points.push(`${bl}px 100%`);
      points.push(`0% calc(100% - ${bl}px)`);
    } else {
      points.push(`0% 100%`);
    }

    // Close the path back to start
    if (tl > 0) {
      points.push(`0% ${tl}px`);
    }

    return `polygon(${points.join(", ")})`;
  };

  const clipPath = generateClipPath();

  return (
    <div
      className={cn("bg-card relative overflow-hidden rounded-xl", className)}
      style={{
        clipPath,
        WebkitClipPath: clipPath,
        ...style,
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
      <Card className={cn("relative", className)} style={innerStyle} {...rest}>
        {children}
      </Card>
    </Card>
  );
};
