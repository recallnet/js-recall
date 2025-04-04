"use client";

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

  // Detect the appropriate previewer type based on content type and filename
  const { type, context } = detectContentType(contentType, fileName);

  // Return the appropriate previewer based on the detected type
  switch (type) {
    case FilePreviewType.PLAIN_TEXT:
    case FilePreviewType.JSON:
    case FilePreviewType.MARKDOWN:
    case FilePreviewType.JSONL:
      // For now, all text-based formats use the same PlainTextPreview
      // We'll implement specialized viewers in a future project
      return <PlainTextPreview {...props} />;

    case FilePreviewType.BINARY:
    default:
      // Default to binary metadata preview for unknown types
      return <BinaryMetadataPreview {...props} />;
  }
}
