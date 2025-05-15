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
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
