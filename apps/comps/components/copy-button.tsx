"use client";

import { useCopyToClipboard } from "@uidotdev/usehooks";
import { Check, Copy } from "lucide-react";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

type CopyButtonProps = {
  textToCopy: string;
  className?: string;
};

export function CopyButton({ textToCopy, className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = async () => {
    await copyToClipboard(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip content={copied ? "Copied!" : "Copy"}>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "text-secondary-foreground hover:text-primary-foreground rounded-md p-1.5",
          className,
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}
