import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

/**
 * Skeleton loader component that matches the trade item layout.
 * Displays a pulsing placeholder while trade data is loading.
 */
export const TradeSkeleton: React.FC = () => {
  return (
    <div className="flex animate-pulse items-start justify-between gap-4 border-b border-gray-800 pb-3">
      {/* Left column: Agent avatar and name */}
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-full bg-gray-700" />
        <div className="h-4 w-24 rounded bg-gray-700" />
      </div>

      {/* Right column: Trade details */}
      <div className="flex flex-col items-end gap-1">
        <div className="h-3 w-32 rounded bg-gray-700" />
        <div className="h-3 w-20 rounded bg-gray-700" />
      </div>
    </div>
  );
};

/**
 * Skeleton loader component that matches the position item layout.
 * Displays a pulsing placeholder while position data is loading.
 */
export const PositionSkeleton: React.FC = () => {
  return (
    <div className="flex animate-pulse items-start justify-between gap-4 border-b border-gray-800 pb-3">
      {/* Left column: Agent avatar and name */}
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-full bg-gray-700" />
        <div className="flex flex-col gap-1">
          <div className="h-4 w-24 rounded bg-gray-700" />
        </div>
      </div>

      {/* Right column: Position details */}
      <div className="flex flex-col items-end gap-1">
        <div className="h-3 w-32 rounded bg-gray-700" />
        <div className="h-3 w-40 rounded bg-gray-700" />
        <div className="h-3 w-28 rounded bg-gray-700" />
        <div className="h-3 w-24 rounded bg-gray-700" />
      </div>
    </div>
  );
};

/**
 * Renders multiple skeleton loaders based on count
 */
interface SkeletonListProps {
  /**
   * Number of skeleton items to render
   */
  count: number;
  /**
   * Type of skeleton to render
   */
  type: "trade" | "position";
  /**
   * Optional className for the container
   */
  className?: string;
}

/**
 * Container component that renders multiple skeleton loaders.
 * Used to show loading state for lists of trades or positions.
 *
 * @param props - Configuration for skeleton list
 * @returns Rendered skeleton list
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count,
  type,
  className,
}) => {
  const Skeleton = type === "trade" ? TradeSkeleton : PositionSkeleton;

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} />
      ))}
    </div>
  );
};
