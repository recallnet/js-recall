import { Copy } from "lucide-react";

import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

interface CopyButtonProps {
  value: string;
  tooltip?: string;
  successMessage?: string;
  className?: string;
  iconClassName?: string;
}

export function CopyButton({
  value,
  tooltip = "Copy to clipboard",
  successMessage = "Copied to clipboard",
  className,
  iconClassName,
}: CopyButtonProps) {
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);

    // Show toast and automatically dismiss after 3 seconds
    const { dismiss } = toast({ title: successMessage });
    setTimeout(() => {
      dismiss();
    }, 3000);
  };

  return (
    <div
      title={tooltip}
      onClick={handleCopy}
      className={cn("cursor-pointer", className)}
    >
      <Copy
        className={cn("size-4 opacity-20 hover:opacity-100", iconClassName)}
      />
    </div>
  );
}
