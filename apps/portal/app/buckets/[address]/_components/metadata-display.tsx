import { Calendar, Check, Copy, FileType, Hash, Link as LinkIcon, Tag, Type } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui/components/button";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@recallnet/ui/lib/utils";

interface Props {
  metadata: readonly {
    key: string;
    value: string;
  }[];
  className?: string;
}

type MetadataType = "date" | "hash" | "link" | "type" | "tag" | "text";

function getMetadataType(key: string, value: string): MetadataType {
  if (key === "date") return "date";
  if (key === "type" || key.endsWith("Type")) return "type";
  if (key === "tag" || key === "tags") return "tag";
  if (value.startsWith("http://") || value.startsWith("https://")) return "link";
  if (value.startsWith("0x") && value.length > 32) return "hash";
  return "text";
}

function getMetadataIcon(type: MetadataType) {
  switch (type) {
    case "date":
      return Calendar;
    case "hash":
      return Hash;
    case "link":
      return LinkIcon;
    case "type":
      return FileType;
    case "tag":
      return Tag;
    default:
      return Type;
  }
}

function getMetadataColor(type: MetadataType): string {
  switch (type) {
    case "date":
      return "text-blue-500";
    case "hash":
      return "text-purple-500";
    case "link":
      return "text-green-500";
    case "type":
      return "text-orange-500";
    case "tag":
      return "text-pink-500";
    default:
      return "text-gray-500";
  }
}

function formatValue(type: MetadataType, value: string): string {
  switch (type) {
    case "date":
      return new Date(value).toLocaleString();
    case "hash":
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    default:
      return value;
  }
}

function MetadataItem({ item: { key, value } }: { item: { key: string; value: string } }) {
  const [copied, setCopied] = useState(false);
  const type = getMetadataType(key, value);
  const Icon = getMetadataIcon(type);
  const color = getMetadataColor(type);
  const formattedValue = formatValue(type, value);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/5">
      <Icon className={cn("h-4 w-4", color)} />
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <span className="font-mono text-sm text-muted-foreground">{key}:</span>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              {type === "link" ? (
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("truncate font-mono text-sm hover:underline", color)}
                >
                  {formattedValue}
                </a>
              ) : (
                <span className={cn("truncate font-mono text-sm", color)}>
                  {formattedValue}
                </span>
              )}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                side="top"
              >
                <p>{value}</p>
                <Tooltip.Arrow className="fill-popover" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 opacity-50" />
        )}
      </Button>
    </div>
  );
}

export default function MetadataDisplay({ metadata, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {metadata.map((item) => (
        <MetadataItem key={item.key} item={item} />
      ))}
    </div>
  );
}