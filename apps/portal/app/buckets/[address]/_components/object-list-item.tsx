import { ChevronDown, ChevronUp, File, FileCode, FileImage, FileText } from "lucide-react";
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

import Metric from "@/components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";
import { formatBytes } from "@/lib/format-bytes";
import { removePrefix } from "@/lib/remove-prefix";

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
  if (!type) return File;
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("text/")) return FileText;
  if (type.includes("json") || type.includes("javascript") || type.includes("typescript")) return FileCode;
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
            title={displayName}
          >
            <FileIcon className="flex-shrink-0 text-primary" />
            <div className={viewMode === "grid" ? "flex flex-col gap-1 min-w-0" : "flex-1 min-w-0"}>
              <div className="truncate font-medium leading-6">{displayName}</div>
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
            <pre className="text-muted-foreground min-h-12 border p-4 font-mono overflow-auto">
              {arrayToDisplay(object.state.metadata)}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
