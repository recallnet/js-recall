"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) => (
  <CollapsiblePrimitive.Trigger asChild>
    <button
      type="button"
      className={cn("group flex w-full items-center", className)}
      {...props}
    >
      <ChevronDown className="text-secondary-foreground duration-400 h-6 w-6 transition-transform group-data-[state=closed]:-rotate-90" />
      {children}
    </button>
  </CollapsiblePrimitive.Trigger>
);

const CollapsibleContent = ({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) => (
  <CollapsiblePrimitive.Content
    className={cn(
      "duration-400 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 mt-7 overflow-hidden border-t pt-7",
      className,
    )}
    {...props}
  />
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
