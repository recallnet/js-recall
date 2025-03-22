import { Database, Calendar, FileType, Hash, Link as LinkIcon, Tag, Type } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";
import { cn } from "@recallnet/ui/lib/utils";

interface Props {
  addr: string;
  metadata: readonly {
    key: string;
    value: string;
  }[];
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
  const type = getMetadataType(key, value);
  const Icon = getMetadataIcon(type);
  const color = getMetadataColor(type);
  const formattedValue = formatValue(type, value);

  return (
    <div className="flex items-center gap-1">
      <Icon className={cn("h-3 w-3", color)} />
      <span className={cn("font-mono text-xs", color)}>
        {formattedValue}
      </span>
    </div>
  );
}

export default function BucketNameDisplay({ addr, metadata }: Props) {
  // Extract bucket name and type from metadata
  const bucketName = metadata.find((m) => m.key === "name")?.value;
  const bucketType = metadata.find((m) => m.key === "type")?.value;

  // Filter out name and type from additional metadata display
  const additionalMetadata = metadata.filter(
    (m) => !["name", "type"].includes(m.key)
  );

  return (
    <Link href={`/buckets/${addr}`} className="group flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Database className="text-primary h-5 w-5" />
        <div className="flex items-center gap-2">
          {bucketName ? (
            <span className="font-mono text-lg font-semibold text-primary">
              {bucketName}
            </span>
          ) : null}
          <CollapsedStringDisplay
            value={addr}
            showCopy
            copyTooltip="Copy bucket address"
            copySuccessMessage="Bucket address copied"
            className={cn(
              "text-sm font-mono",
              bucketName ? "text-muted-foreground" : "text-primary"
            )}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 pl-7">
        {bucketType && (
          <MetadataItem item={{ key: "type", value: bucketType }} />
        )}
        {additionalMetadata.map((meta) => (
          <MetadataItem key={meta.key} item={meta} />
        ))}
      </div>
    </Link>
  );
}