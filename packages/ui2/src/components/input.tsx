import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

export type InputProps = React.JSX.IntrinsicElements["input"];

const Input = function Input({ className, type, ref, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "placeholder:text-secondary-foreground flex h-10 w-full rounded-md border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

export { Input };
