"use client";

import { FileQuestion } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@recallnet/ui/components/button";

import { formatBytes } from "@/lib/format-bytes";

import { FilePreviewerProps } from "./types";

/**
 * A fallback previewer for binary or unknown file types
 * Shows a simple message instead of duplicating metadata
 */
export function BinaryMetadataPreview({
  fileName,
  contentType,
  size,
}: FilePreviewerProps) {
  const [sizeFormatted, setSizeFormatted] = useState<{
    val: string | number;
    unit?: string;
    formatted?: string;
  }>({ val: "0", unit: "B" });

  useEffect(() => {
    if (size) {
      setSizeFormatted(formatBytes(Number(size)));
    }
  }, [size]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center">
        <FileQuestion className="text-muted-foreground mb-6 size-24" />
        <h3 className="mb-3 text-xl font-medium">Binary or Unknown File</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          {fileName} ({contentType || "Unknown type"},{" "}
          {sizeFormatted.formatted ||
            `${sizeFormatted.val} ${sizeFormatted.unit || ""}`}
          )
        </p>
        <p className="text-muted-foreground mb-6 mt-4 max-w-md text-sm">
          This file type cannot be previewed in the browser. You can download it
          using the download button above.
        </p>
        <p className="text-muted-foreground text-xs">
          See complete file details in the metadata panel below.
        </p>
      </div>
    </div>
  );
}
