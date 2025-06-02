import { cn } from "@recallnet/ui2/lib/utils";

/**
 * Skeleton component for loading states
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("h-2 w-10 animate-pulse rounded-xl bg-gray-700", className)}
      {...props}
    />
  );
}
