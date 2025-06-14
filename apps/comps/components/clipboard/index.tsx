import React from 'react'
import Tooltip from "@/../../packages/ui2/src/components/tooltip"
import {CopyIcon} from "lucide-react"
import {useCopyToClipboard} from "@uidotdev/usehooks";
import {cn} from "@recallnet/ui2/lib/utils";

export const Clipboard = ({text, className}: {text: string, className?: string}) => {
  const [copied, setCopied] = React.useState(false);
  const [_, copyToClipboard] = useCopyToClipboard();

  const handleCopy = async () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex items-center justify-between rounded border px-3 py-2 overflow-hidden", className)}>
      <p className="truncate text-sm text-gray-500">{text}</p>
      <Tooltip content={copied ? "Copied!" : "Copy"}>
        <CopyIcon
          className="text-muted-foreground ml-2 h-6 w-6 translate-y-1 cursor-pointer hover:text-white"
          onClick={handleCopy}
        />
      </Tooltip>
    </div>
  )
}
