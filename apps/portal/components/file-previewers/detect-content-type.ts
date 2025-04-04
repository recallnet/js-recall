import { FilePreviewType, FileTypeDetectionResult } from "./types";

// Common text file extensions
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "jsonl",
  "yml",
  "yaml",
  "toml",
  "xml",
  "svg",
  "sh",
  "bash",
  "zsh",
  "fish",
  "py",
  "rb",
  "php",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "swift",
  "kt",
  "sql",
  "graphql",
  "prisma",
  "env",
  "ini",
  "conf",
  "config",
  "log",
  "diff",
]);

// Common markdown file extensions
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkdn"]);

// Common JSON file extensions
const JSON_EXTENSIONS = new Set(["json", "json5", "ipynb"]);

// Common JSONL file extensions
const JSONL_EXTENSIONS = new Set(["jsonl", "ldjson", "ndjson"]);

// Generic content types that should be ignored when extension-based detection can be used
const GENERIC_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/binary",
]);

// Map of content types to preview types
const CONTENT_TYPE_TO_PREVIEW_TYPE: Record<string, FilePreviewType> = {
  // Plain text
  "text/plain": FilePreviewType.PLAIN_TEXT,
  "text/csv": FilePreviewType.PLAIN_TEXT,
  "text/html": FilePreviewType.PLAIN_TEXT,
  "text/css": FilePreviewType.PLAIN_TEXT,
  "text/javascript": FilePreviewType.PLAIN_TEXT,
  "text/typescript": FilePreviewType.PLAIN_TEXT,
  "text/x-python": FilePreviewType.PLAIN_TEXT,
  "text/x-java": FilePreviewType.PLAIN_TEXT,
  "text/x-c": FilePreviewType.PLAIN_TEXT,
  "text/x-script.sh": FilePreviewType.PLAIN_TEXT,
  "text/x-script.perl": FilePreviewType.PLAIN_TEXT,

  // Markdown
  "text/markdown": FilePreviewType.MARKDOWN,
  "text/x-markdown": FilePreviewType.MARKDOWN,

  // JSON
  "application/json": FilePreviewType.JSON,
  "application/ld+json": FilePreviewType.JSONL,

  // Fallbacks for common types that would need custom previewers in the future
  "image/png": FilePreviewType.BINARY,
  "image/jpeg": FilePreviewType.BINARY,
  "image/gif": FilePreviewType.BINARY,
  "image/svg+xml": FilePreviewType.BINARY,
  "application/pdf": FilePreviewType.BINARY,
  "application/zip": FilePreviewType.BINARY,
  "application/x-tar": FilePreviewType.BINARY,
  "application/x-gzip": FilePreviewType.BINARY,
  "application/octet-stream": FilePreviewType.BINARY,
};

/**
 * Extracts the extension from a filename
 * @param fileName The filename to extract extension from
 * @returns The lowercase extension without the dot, or empty string if no extension
 */
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Detects the appropriate file preview type based on content type and filename
 *
 * Uses multiple strategies:
 * 1. Check extension for known text formats (JSONL, JSON, Markdown, etc.)
 * 2. Check content type mapping for specific content types
 * 3. Fall back to generic extension-based detection
 * 4. Default to binary/unknown if no match
 *
 * @param contentType The MIME type of the content
 * @param fileName The filename with extension
 * @returns The detected file preview type and context information
 */
export function detectContentType(
  contentType?: string,
  fileName?: string,
): FileTypeDetectionResult {
  // Extract extension if filename is available
  const extension = fileName ? getFileExtension(fileName) : "";

  // Strategy 1: Check for known text formats by extension first
  // This takes precedence over generic content types
  if (extension) {
    // For specific formats like JSONL, always prioritize extension detection
    // regardless of content type
    if (JSONL_EXTENSIONS.has(extension)) {
      return {
        type: FilePreviewType.JSONL,
        context: {
          source: "extension-priority",
          extension,
          originalContentType: contentType,
        },
      };
    }

    // For JSON files
    if (JSON_EXTENSIONS.has(extension)) {
      return {
        type: FilePreviewType.JSON,
        context: {
          source: "extension-priority",
          extension,
          originalContentType: contentType,
        },
      };
    }

    // For Markdown files
    if (MARKDOWN_EXTENSIONS.has(extension)) {
      return {
        type: FilePreviewType.MARKDOWN,
        context: {
          source: "extension-priority",
          extension,
          originalContentType: contentType,
        },
      };
    }
  }

  // Strategy 2: Use content type if available and it's not a generic type
  if (
    contentType &&
    !GENERIC_CONTENT_TYPES.has(contentType) &&
    CONTENT_TYPE_TO_PREVIEW_TYPE[contentType]
  ) {
    return {
      type: CONTENT_TYPE_TO_PREVIEW_TYPE[contentType],
      context: { source: "content-type", contentType },
    };
  }

  // Strategy 3: Fall back to extension-based detection for any text file
  if (extension) {
    if (TEXT_EXTENSIONS.has(extension)) {
      return {
        type: FilePreviewType.PLAIN_TEXT,
        context: {
          source: "extension",
          extension,
          originalContentType: contentType,
        },
      };
    }

    // If we have an extension but no match, we can use it for informational purposes
    return {
      type: FilePreviewType.BINARY,
      context: {
        source: "extension-fallback",
        extension,
        originalContentType: contentType,
      },
    };
  }

  // Strategy 4: No matching content type or usable extension, default to binary
  return {
    type: FilePreviewType.BINARY,
    context: {
      source: "default",
      originalContentType: contentType,
    },
  };
}
