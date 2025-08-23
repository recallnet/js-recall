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
}: {
  text: string;
  textOnCopy?: string;
  className?: string;
}) => {
  const [copied, setCopied] = React.useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = async () => {
    copyToClipboard(textOnCopy || text);
    setCopied(true);
    toast.success("Wallet Address copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  //outer div is necessary because copy icon for some reason reduces its size because the tooltip
  return (
    <div>
      <Tooltip content={copied ? "Copied!" : "Copy"}>
        <div
          className={cn(
            "flex cursor-pointer items-center justify-between gap-2 rounded border px-3 py-2 text-sm text-gray-500 hover:text-gray-300",
            className,
          )}
          onClick={handleCopy}
        >
          <p className="truncate">{text}</p>
          <div className="relative h-4 w-10">
            <CopyIcon className="absolute right-1 h-4 w-4 cursor-pointer" />
          </div>
        </div>
      </Tooltip>
    </div>
  );
};
