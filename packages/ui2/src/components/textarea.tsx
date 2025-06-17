import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

export type TextareaProps = React.JSX.IntrinsicElements["textarea"];

const Textarea = function Textarea({
  className,
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        "placeholder:text-secondary-foreground flex min-h-[80px] w-full resize-y rounded-md border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

export { Textarea };
