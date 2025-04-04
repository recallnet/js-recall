/**
 * Types and interfaces for the file previewer components
 */
import { Address } from "viem";

/**
 * Interface for all file previewer components to implement
 */
export interface FilePreviewerProps {
  /** The bucket address where the object is stored */
  bucketAddress: Address;

  /** The key/path of the object */
  path: string;

  /** The name of the file (extracted from path) */
  fileName: string;

  /** The content type of the object (if available) */
  contentType?: string;

  /** Size of the object in bytes */
  size: bigint | number;

  /** Expiry time of the object (if available) */
  expiry?: bigint;

  /** Additional metadata fields for the object */
  metadata?:
    | Record<string, unknown>[]
    | readonly { key: string; value: string }[];
}

/**
 * Enum of supported file preview types
 */
export enum FilePreviewType {
  PLAIN_TEXT = "plaintext",
  JSON = "json",
  MARKDOWN = "markdown",
  JSONL = "jsonl",
  BINARY = "binary",
  CUSTOM = "custom",
}

/**
 * Interface for file type detection result
 */
export interface FileTypeDetectionResult {
  /** The detected file preview type */
  type: FilePreviewType;

  /** Additional contextual information about the file (specific to the type) */
  context?: Record<string, unknown>;
}
