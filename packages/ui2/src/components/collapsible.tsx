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
  <CollapsiblePrimitive.Trigger
    className={cn("flex w-full items-center", className)}
    {...props}
  >
    <CollapsiblePrimitive.CollapsibleTrigger asChild>
      <ChevronDown className="text-secondary-foreground h-6 w-6 transition-transform duration-200 data-[state=open]:rotate-180" />
    </CollapsiblePrimitive.CollapsibleTrigger>
    {children}
  </CollapsiblePrimitive.Trigger>
);

const CollapsibleContent = ({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) => (
  <CollapsiblePrimitive.Content
    className={cn(
      "data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden",
      className,
    )}
    {...props}
  />
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
