import { Share2 } from "lucide-react";

import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

interface ShareButtonProps {
  url: string;
  tooltip?: string;
  successMessage?: string;
  className?: string;
  iconClassName?: string;
}

export function ShareButton({
  url,
  tooltip = "Copy object URL",
  successMessage = "Object URL copied to clipboard",
  className,
  iconClassName,
}: ShareButtonProps) {
  const { toast } = useToast();

  const handleShare = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url);

    // Show toast and automatically dismiss after 3 seconds
    const { dismiss } = toast({ title: successMessage });
    setTimeout(() => {
      dismiss();
    }, 3000);
  };

  return (
    <div
      title={tooltip}
      onClick={handleShare}
      className={cn("cursor-pointer", className)}
    >
      <Share2
        className={cn("size-4 opacity-20 hover:opacity-100", iconClassName)}
      />
    </div>
  );
}
