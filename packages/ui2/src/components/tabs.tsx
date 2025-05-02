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

export type TabsTriggerProps = React.ComponentPropsWithRef<
  typeof TabsPrimitive.Trigger
>;

function TabsTrigger({ className, ref, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "text-primary inline-flex whitespace-nowrap px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:underline",
        className,
      )}
      {...props}
    />
  );
}

export type TabsContentProps = React.ComponentPropsWithRef<
  typeof TabsPrimitive.Content
>;

function TabsContent({ className, ref, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content ref={ref} className={cn("", className)} {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
