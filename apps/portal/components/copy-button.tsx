import { Copy, Share2 } from "lucide-react";
import React from "react";

import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

// Extend SVGProps for direct SVG element attributes
type CopyButtonProps = {
  value: string;
  type?: "copy" | "share";
  tooltip?: string;
  successMessage?: string;
  // We still need a wrapperClassName for the tooltip span
  wrapperClassName?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "onClick">; // Omit onClick as we handle it on the span

export function CopyButton({
  value,
  type = "copy",
  tooltip: tooltipProp,
  successMessage: successMessageProp,
  className, // This will now apply to the SVG
  wrapperClassName, // New prop for the wrapper
  ...rest // Capture remaining SVG props
}: CopyButtonProps) {
  const { toast } = useToast();

  // Determine defaults based on type
  const defaultTooltip = type === "share" ? "Copy link" : "Copy to clipboard";
  const defaultSuccessMessage =
    type === "share" ? "Link copied to clipboard" : "Copied to clipboard";

  const tooltip = tooltipProp ?? defaultTooltip;
  const successMessage = successMessageProp ?? defaultSuccessMessage;

  const handleCopy = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click event from bubbling up
    navigator.clipboard.writeText(value);
    toast({ title: successMessage });
  };

  const Icon = type === "share" ? Share2 : Copy;

  // Render the Icon within a span for tooltip and click handling
  return (
    <span
      title={tooltip}
      onClick={handleCopy}
      className={cn("cursor-pointer inline-flex items-center justify-center", wrapperClassName)}
    >
      <Icon
        className={cn(
          "size-4 opacity-20 hover:opacity-100", // Base styles for the icon
          className // Merge with user-provided className for the icon itself
        )}
        aria-hidden="true" // Icon is decorative
        {...rest} // Spread remaining props onto the SVG element
      />
    </span>
  );
}
