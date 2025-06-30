import { cn } from "@recallnet/ui2/lib/utils";

import { CopyButton } from "../copy-button";

export const Clipboard = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  return (
    <div className={cn("flex items-center overflow-hidden", className)}>
      <span className="text-primary-foreground truncate text-sm">{text}</span>
      <CopyButton textToCopy={text} />
    </div>
  );
};
