"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@recallnet/ui2/lib/utils";

// This is just an example of a component that uses Radix UI, the cn utility and Tailwind CSS classes.

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn("flex size-full items-center justify-center", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
