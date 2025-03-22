import {
  ChevronDown,
  ChevronUp,
  File,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  FileType,
  Archive,
  Table,
  FileSliders,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Address } from "viem";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";
import { cn } from "@recallnet/ui/lib/utils";

import Metric from "@/components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";
import { formatBytes } from "@/lib/format-bytes";
import { removePrefix } from "@/lib/remove-prefix";
import MetadataDisplay from "./metadata-display";

interface Props {
  bucketAddress: Address;
  parentPath: string;
  object: {
    key: string;
    state: {
      blobHash: string;
      size: bigint;
      metadata: readonly {
        key: string;
        value: string;
      }[];
    };
  };
  delimiter: string;
  viewMode?: "list" | "grid";
}

function getFileIcon(type: string | undefined) {
  if (!type) {
    // Try to guess from extension
    const ext = type?.split(".").pop()?.toLowerCase();
    if (ext) {
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
      if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return FileVideo;
      if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return FileAudio;
      if (['pdf'].includes(ext)) return FileType;
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
      if (['xls', 'xlsx', 'csv'].includes(ext)) return Table;
      if (['ppt', 'pptx'].includes(ext)) return FileSliders;
      if (['txt', 'md', 'rtf'].includes(ext)) return FileText;
      if (['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'rb', 'php'].includes(ext)) return FileCode;
    }
    return File;
  }

  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  if (type.includes("pdf")) return FileType;
  if (type.includes("zip") || type.includes("compressed") || type.includes("archive")) return Archive;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return Table;
  if (type.includes("presentation") || type.includes("powerpoint")) return FileSliders;
  if (type.startsWith("text/")) return FileText;
  if (type.includes("json") || type.includes("javascript") || type.includes("typescript") ||
      type.includes("html") || type.includes("css")) return FileCode;
  return File;
}

export default function ObjectListItem({
  bucketAddress,
  parentPath,
  object,
  delimiter,
  viewMode = "list",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const size = formatBytes(Number(object.state.size));
  const type = object.state.metadata.find((m) => m.key === "type")?.value;
  const FileIcon = getFileIcon(type);

  const displayName = removePrefix(object.key, parentPath);
  const displayDate = object.state.metadata.find((m) => m.key === "date")?.value;

  return (
    <Card className="rounded-none hover:bg-accent/5 transition-colors truncate">
      <CardHeader className="relative px-6 py-3">
        <CardTitle className="flex items-center gap-4">
          <Link
            href={{
              pathname: `/buckets/${bucketAddress}`,
              query: {
                path: object.key,
                ...(delimiter !== "/" ? { delimiter } : {}),
              },
            }}
            className="flex items-center gap-4 flex-1 min-w-0"
          >
            <FileIcon className="flex-shrink-0 text-primary" />
            <div className={viewMode === "grid" ? "flex flex-col gap-1 min-w-0" : "flex-1 min-w-0"}>
              <div className="truncate font-medium leading-6 font-mono">
                {displayName}
              </div>
              {viewMode === "grid" && (
                <>
                  <span className="text-xs text-muted-foreground">{size.val} {size.unit}</span>
                  {displayDate && (
                    <span className="text-xs text-muted-foreground">{new Date(displayDate).toLocaleDateString()}</span>
                  )}
                </>
              )}
            </div>
            {viewMode === "list" && (
              <>
                <span className="text-sm text-muted-foreground ml-auto flex-shrink-0">{size.val} {size.unit}</span>
                {displayDate && (
                  <span className="text-sm text-muted-foreground w-32 flex-shrink-0">
                    {new Date(displayDate).toLocaleDateString()}
                  </span>
                )}
              </>
            )}
          </Link>
          {!isOpen && (
            <ChevronDown
              className="ml-auto opacity-40 hover:opacity-100 cursor-pointer flex-shrink-0"
              onClick={() => setIsOpen(true)}
            />
          )}
          {isOpen && (
            <ChevronUp
              className="ml-auto opacity-40 hover:opacity-100 cursor-pointer flex-shrink-0"
              onClick={() => setIsOpen(false)}
            />
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="grid grid-cols-2 gap-6 px-6 py-4">
          <Metric
            title="Blob Hash"
            value={
              <CollapsedStringDisplay
                value={object.state.blobHash}
                showCopy
                copyTooltip="Copy blob hash"
                copySuccessMessage="Blob hash copied"
              />
            }
            valueTooltip={object.state.blobHash}
          />
          <Metric title="Size" value={size.val} subtitle={size.unit} />
          <div className="col-span-2 flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Metadata</span>
            <MetadataDisplay metadata={object.state.metadata} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
