"use client";

import { useEffect, useState } from "react";

import { BinaryMetadataPreview } from "./binary-metadata-preview";
import { detectContentType } from "./detect-content-type";
import { PlainTextPreview } from "./plain-text-preview";
import { FilePreviewType, FilePreviewerProps } from "./types";

/**
 * Main file previewer component
 * Determines which specific previewer to use based on file type
 */
export function FilePreviewer(props: FilePreviewerProps) {
  const { fileName, contentType } = props;
  const [detectedType, setDetectedType] = useState<FilePreviewType | null>(
    null,
  );

  // Detect the appropriate previewer type based on content type and filename
  useEffect(() => {
    const result = detectContentType(contentType, fileName);
    setDetectedType(result.type);
  }, [contentType, fileName]);

  // Return the appropriate previewer based on the detected type
  switch (detectedType) {
    case FilePreviewType.PLAIN_TEXT:
    case FilePreviewType.JSON:
    case FilePreviewType.MARKDOWN:
    case FilePreviewType.JSONL:
      // For now, all text-based formats use the same PlainTextPreview
      // We'll implement specialized viewers in a future project
      return <PlainTextPreview bucketAddress={props.bucketAddress} path={props.path} />;

    case FilePreviewType.BINARY:
    default:
      // Default to binary metadata preview for unknown types
      return <BinaryMetadataPreview {...props} />;
  }
}
