import { Zap } from "lucide-react";

import { cn } from "@recallnet/ui2/lib/utils";

interface BoostIconProps {
  className?: string;
  fill?: boolean;
}

/**
 * BoostIcon component that renders a Zap icon with customizable styling
 * @param className - Additional CSS classes to apply
 * @param fill - Whether to fill the icon with yellow color
 */
export function BoostIcon({ className, fill = false }: BoostIconProps) {
  return (
    <Zap
      className={cn(
        "size-4 stroke-[0.8] text-yellow-400",
        fill ? "fill-yellow-400" : "",
        className,
      )}
    />
  );
}
