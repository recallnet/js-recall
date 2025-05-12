import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

const Tabs = TabsPrimitive.Root;

export type TabsListProps = React.ComponentPropsWithRef<
  typeof TabsPrimitive.List
>;

function TabsList({ className, ref, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex h-10 items-center justify-start", className)}
      {...props}
    />
  );
}
TabsList.displayName = TabsPrimitive.List.displayName;

export type TabsTriggerProps = React.ComponentPropsWithRef<
  typeof TabsPrimitive.Trigger
>;

function TabsTrigger({ className, ref, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "text-secondary-foreground underline-offset-6 data-[state=active]:text-primary inline-flex whitespace-nowrap pr-3 text-sm text-xs font-semibold uppercase transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:underline",
        className,
      )}
      {...props}
    />
  );
}
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export type TabsContentProps = React.ComponentPropsWithRef<
  typeof TabsPrimitive.Content
>;

function TabsContent({ className, ref, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content ref={ref} className={cn("", className)} {...props} />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
