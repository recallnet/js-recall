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
        "focus-visible:ring-ring inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=off]:bg-gray-800 data-[state=on]:bg-blue-600 data-[state=off]:text-gray-300 data-[state=on]:text-white data-[state=off]:hover:bg-gray-700 data-[state=off]:hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
