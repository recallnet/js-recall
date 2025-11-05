import { useCopyToClipboard } from "@uidotdev/usehooks";
import { CopyIcon } from "lucide-react";
import React from "react";

import { toast } from "@recallnet/ui2/components/toast";
import Tooltip from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

export const Clipboard = ({
  text,
  textOnCopy,
  className,
  showBorder = true,
}: {
  text: string;
  textOnCopy?: string;
  className?: string;
  showBorder?: boolean;
}) => {
  const [copied, setCopied] = React.useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = async () => {
    copyToClipboard(textOnCopy || text);
    setCopied(true);
    toast.success("Wallet address copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-2 text-gray-500 transition-colors hover:text-gray-300",
        showBorder && "rounded border px-3 py-2",
        className,
      )}
      onClick={handleCopy}
    >
      <span className="min-w-0 truncate">{text}</span>
      <Tooltip content={copied ? "Copied!" : "Copy"}>
        <CopyIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      </Tooltip>
    </div>
  );
};
