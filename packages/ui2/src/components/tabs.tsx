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
      className={cn(
        "inline-flex min-h-10 items-center justify-start",
        className,
      )}
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
        "text-primary inline-flex whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
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
    <TabsPrimitive.Content
      ref={ref}
      className={cn("rounded-xl", className)}
      {...props}
    />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
