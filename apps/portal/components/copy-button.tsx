import { Copy, Share2 } from "lucide-react";
import React from "react";

import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

interface CopyButtonProps {
  value: string;
  type?: "copy" | "share";
  tooltip?: string;
  successMessage?: string;
  className?: string;
  iconClassName?: string;
}

export function CopyButton({
  value,
  type = "copy",
  tooltip: tooltipProp,
  successMessage: successMessageProp,
  className,
  iconClassName,
}: CopyButtonProps) {
  const { toast } = useToast();

  // Determine defaults based on type
  const defaultTooltip = type === "share" ? "Copy link" : "Copy to clipboard";
  const defaultSuccessMessage =
    type === "share" ? "Link copied to clipboard" : "Copied to clipboard";

  const tooltip = tooltipProp ?? defaultTooltip;
  const successMessage = successMessageProp ?? defaultSuccessMessage;

  const handleCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click event from bubbling up
    navigator.clipboard.writeText(value);
    toast({ title: successMessage });
  };

  const Icon = type === "share" ? Share2 : Copy;

  return (
    <div
      title={tooltip}
      onClick={handleCopy}
      className={cn("cursor-pointer inline-flex items-center justify-center", className)}
      // Prevent focus when clicking, similar to Button behavior if needed
      tabIndex={-1}
    >
      <Icon
        className={cn("size-4 opacity-20 hover:opacity-100", iconClassName)}
        aria-hidden="true" // Icon is decorative
      />
    </div>
  );
}
