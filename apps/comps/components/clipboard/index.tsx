import { useCopyToClipboard } from "@uidotdev/usehooks";
import { CopyIcon } from "lucide-react";
import React from "react";

import { toast } from "@recallnet/ui2/components/toast";
import Tooltip from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

export const Clipboard = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const [copied, setCopied] = React.useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = async () => {
    copyToClipboard(text);
    setCopied(true);
    toast.success("Wallet Address copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  //outer div is necesary because copy icon for some reason reduces its size because the tooltip
  return (
    <div className="relative">
      <Tooltip content={copied ? "Copied!" : "Copy"}>
        <div
          className={cn(
            "flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm text-gray-500",
            className,
          )}
          onClick={handleCopy}
        >
          <p className="mr-2 truncate">{text}</p>
          <CopyIcon className="text-muted-foreground absolute right-3 ml-2 h-4 w-4 cursor-pointer" />
        </div>
      </Tooltip>
    </div>
  );
};
