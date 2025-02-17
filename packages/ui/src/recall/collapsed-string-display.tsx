"use client";

import { Copy } from "lucide-react";
import { HTMLAttributes } from "react";

import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  value: string;
  numChars?: number;
  separator?: string;
  showCopy?: boolean;
  copyTooltip?: string;
  copySuccessMessage?: string;
};

export default function CollapsedStringDisplay({
  value,
  numChars,
  separator,
  showCopy,
  copyTooltip,
  copySuccessMessage,
  className,
  ...rest
}: Props) {
  const { toast } = useToast();

  numChars = numChars ?? 4;
  separator = separator ?? "…";

  const handleCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    navigator.clipboard.writeText(value);
    toast({ title: copySuccessMessage ?? "Copied to clipboard" });
  };

  return (
    <div
      title={value}
      className={cn("flex items-center gap-3", className)}
      {...rest}
    >
      {`${value.slice(0, numChars)}${separator}${value.slice(-numChars)}`}
      {showCopy && (
        <div title={copyTooltip ?? "Copy value"} onClick={handleCopy}>
          <Copy className="size-4 opacity-20 hover:opacity-100" />
        </div>
      )}
    </div>
  );
}
