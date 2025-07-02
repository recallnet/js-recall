import {useCopyToClipboard} from "@uidotdev/usehooks";
import {CopyIcon} from "lucide-react";
import React from "react";

import {cn} from "@recallnet/ui2/lib/utils";

import Tooltip from "@/../../packages/ui2/src/components/tooltip";

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
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between overflow-hidden rounded border px-3 py-2 text-sm text-gray-500",
        className,
      )}
    >
      <p className="truncate">{text}</p>
      <Tooltip content={copied ? "Copied!" : "Copy"}>
        <CopyIcon
          className="text-muted-foreground ml-2 h-4 w-4 cursor-pointer hover:text-white"
          onClick={handleCopy}
        />
      </Tooltip>
    </div>
  );
};
