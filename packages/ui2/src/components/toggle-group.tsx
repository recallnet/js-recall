import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

const ToggleGroup = ToggleGroupPrimitive.Root;

export type ToggleGroupItemProps = React.ComponentPropsWithRef<
  typeof ToggleGroupPrimitive.Item
>;

function ToggleGroupItem({ className, ref, ...props }: ToggleGroupItemProps) {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium transition-all",
        "focus-visible:border-2 focus-visible:border-[#33A5FF] focus-visible:outline-none",
        "disabled:pointer-events-none",
        // Primary styles (selected/on)
        "data-[state=on]:bg-gray-6 data-[state=on]:text-black",
        "data-[state=on]:hover:bg-gray-5",
        "data-[state=on]:disabled:bg-gray-4 data-[state=on]:disabled:text-gray-100",
        // Secondary styles (unselected/off)
        "data-[state=off]:border-gray-4 data-[state=off]:border data-[state=off]:bg-transparent data-[state=off]:text-gray-100",
        "data-[state=off]:hover:bg-gray-4/10",
        "data-[state=off]:disabled:text-gray-4 data-[state=off]:disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
