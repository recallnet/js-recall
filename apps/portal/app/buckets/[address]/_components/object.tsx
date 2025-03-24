import TimeAgo from "javascript-time-ago";
import { Download, File, Loader2, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Address } from "viem";
import {
  useAccount,
  useBlockNumber,
  useChainId,
  useWaitForTransactionReceipt,
} from "wagmi";

import { numBlocksToSeconds } from "@recallnet/bigint-utils/conversions";
import { getChain, getObjectApiUrl } from "@recallnet/chains";
import { downloadBlob } from "@recallnet/sdk/provider";
import { useDeleteObject, useGetObject } from "@recallnet/sdkx/react/buckets";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";

import Metric from "@/components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";
import { formatBytes } from "@/lib/format-bytes";

const timeAgo = new TimeAgo("en-US");

// Maximum size for full content display (1MB)
const MAX_FULL_DISPLAY_SIZE = 1024 * 1024;
// Maximum size for preview (5MB)
const MAX_PREVIEW_SIZE = 5 * 1024 * 1024;
// Preview length in characters
const PREVIEW_LENGTH = 1000;

// Types of files we can preview
const PREVIEWABLE_TYPES = new Set([
  "application/json",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/x-markdown",
]);

interface Props {
  bucketAddress: Address;
  name: string;
  path: string;
  parentPath: string;
  delimiter: string;
}

/**
 * Object Component
 * Displays and manages object content from Recall buckets with preview capabilities.
 *
 * Features:
 * - Automatic MIME type detection
 * - Content preview for supported file types (JSON, text, markdown, CSV)
 * - Pretty printing for JSON content
 * - Size-based content truncation with full content toggle
 * - Debug logging for content fetching and rendering
 *
 * @param bucketAddress - The address of the bucket containing the object
 * @param name - The name of the object
 * @param prefix - The full path/prefix of the object
 * @param containingPrefix - The prefix of the containing directory
 */
export default function Object({
  bucketAddress,
  name,
  path,
  parentPath,
  delimiter,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { address: fromAddress } = useAccount();
  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber();
  const [detectedMimeType, setDetectedMimeType] = useState<
    string | undefined
  >();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const {
    data: object,
    error: objectError,
    isLoading: objectLoading,
  } = useGetObject(bucketAddress, path);

  /**
   * Detects MIME type from file content using file-type library and extension fallbacks.
   * Handles special cases for text-based files (JSON, txt, md, csv).
   *
   * @param url - The URL of the object to analyze
   */
  const detectMimeType = async (url: string) => {
    try {
      // Fetch first 4100 bytes of the file (magic numbers are usually in the first few bytes)
      const foo = await downloadBlob(url, bucketAddress, path);
      const response = await fetch(url, {
        headers: {
          Range: "bytes=0-4099",
        },
      });

      if (!response.ok) {
        return;
      }

      const buffer = await response.arrayBuffer();
      const { fileTypeFromBuffer } = await import("file-type");
      const fileType = await fileTypeFromBuffer(new Uint8Array(buffer));

      if (fileType) {
        setDetectedMimeType(fileType.mime);
      } else {
        // Handle text-based files by extension
        const extension = name.split(".").pop()?.toLowerCase();
        let detectedType: string | undefined;

        switch (extension) {
          case "json": {
            const text = new TextDecoder().decode(new Uint8Array(buffer));
            try {
              JSON.parse(text);
              detectedType = "application/json";
            } catch {
              detectedType = "text/plain";
            }
            break;
          }
          case "txt":
            detectedType = "text/plain";
            break;
          case "md":
          case "markdown":
            detectedType = "text/markdown";
            break;
          case "csv":
            detectedType = "text/csv";
            break;
        }

        if (detectedType) {
          setDetectedMimeType(detectedType);
        }
      }
    } catch (error) {
      console.error("Error detecting mime type:", error);
    }
  };

  /**
   * Fetches and processes file content for preview.
   * - Handles large files by fetching only preview portion
   * - Validates JSON content when applicable
   * - Provides debug logging for content processing
   *
   * @param url - The URL to fetch content from
   * @param size - The total size of the object
   */
  const fetchContent = async (url: string, size: bigint) => {
    try {
      setIsLoadingContent(true);
      const numericSize = Number(size);

      // If file is too large, only fetch preview
      const range =
        numericSize > MAX_FULL_DISPLAY_SIZE
          ? "bytes=0-" + (PREVIEW_LENGTH - 1)
          : undefined;

      // First try to fetch without the ?object parameter to get raw content
      const rawUrl = url.replace("?object", "");
      const response = await fetch(rawUrl, {
        headers: range ? { Range: range } : {},
      });

      if (!response.ok) {
        return;
      }

      const text = await response.text();

      try {
        // Try to parse as JSON to verify it's valid
        JSON.parse(text);
        setFileContent(text);
      } catch (e) {
        setFileContent(text);
      }
    } catch (error) {
      console.error("Error fetching file content:", error);
      toast({
        title: "Error",
        description: "Failed to load file preview",
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const {
    deleteObject,
    isPending: deletePending,
    data: deleteTxnHash,
    error: deleteError,
  } = useDeleteObject();

  const {
    isFetching: deleteReceiptFetching,
    data: deleteReceipt,
    error: deleteReceiptError,
  } = useWaitForTransactionReceipt({
    hash: deleteTxnHash,
  });

  useEffect(() => {
    if (deleteReceipt) {
      const params = new URLSearchParams();
      if (parentPath) {
        params.set("path", parentPath);
      }
      if (delimiter !== "/") {
        params.set("delimiter", delimiter);
      }
      router.replace(`/buckets/${bucketAddress}?${params.toString()}`);
    }
  }, [bucketAddress, deleteReceipt, parentPath, router, delimiter]);

  useEffect(() => {
    if (objectError || deleteError || deleteReceiptError) {
      toast({
        title: "Error",
        description: objectError?.message,
      });
    }
  }, [toast, objectError, deleteError, deleteReceiptError]);

  // Effect to detect MIME type and fetch content when object is loaded
  useEffect(() => {
    if (object) {
      const contentType = object.metadata.find(
        (m: { key: string; value: string }) => m.key === "content-type",
      )?.value;
      const objectApiUrl = getObjectApiUrl(getChain(chainId));
      const url = `${objectApiUrl}/v1/objects/${bucketAddress}/${path}`;

      // Check file extension first
      const extension = name.split(".").pop()?.toLowerCase();
      let effectiveContentType = contentType;

      if (extension === "json") {
        effectiveContentType = "application/json";
      } else if (contentType === "application/octet-stream") {
        // For octet-stream, try to detect more specific type
        if (extension === "txt") {
          effectiveContentType = "text/plain";
        } else if (extension === "md" || extension === "markdown") {
          effectiveContentType = "text/markdown";
        } else if (extension === "csv") {
          effectiveContentType = "text/csv";
        }
      }

      if (!effectiveContentType) {
        detectMimeType(url);
      } else {
        setDetectedMimeType(effectiveContentType);
      }

      // If it's a previewable type and not too large, fetch content
      const finalContentType = effectiveContentType || detectedMimeType;
      const numericSize = Number(object.size);

      if (
        finalContentType &&
        PREVIEWABLE_TYPES.has(finalContentType) &&
        numericSize <= MAX_PREVIEW_SIZE
      ) {
        fetchContent(url, object.size);
      }
    }
  }, [
    object,
    bucketAddress,
    path,
    chainId,
    name,
    detectedMimeType,
    toast,
    fetchContent,
    detectMimeType,
  ]);

  const handleDelete = () => {
    if (fromAddress === undefined) return;
    deleteObject(bucketAddress, fromAddress, path);
  };

  const objectApiUrl = getObjectApiUrl(getChain(chainId));

  /**
   * Renders content with appropriate formatting based on content type.
   * For JSON content:
   * - Attempts to parse and pretty print with proper indentation
   * - Preserves whitespace and line breaks
   * - Handles truncation for large files
   *
   * @param content - The content to render
   * @param type - The content type (MIME type)
   * @param size - The total size of the content
   */
  const renderContent = (content: string, type: string, size: bigint) => {
    const numericSize = Number(size);
    const isLarge = numericSize > MAX_FULL_DISPLAY_SIZE;
    const displayContent =
      isLarge && !showFullContent ? content : fileContent || content;

    let formattedContent = displayContent;
    if (type === "application/json") {
      try {
        // Parse and re-stringify with pretty formatting
        const parsed = JSON.parse(displayContent || "");
        formattedContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        console.error("Error parsing JSON:", e);
      }
    }

    return (
      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Content Preview</span>
          {isLarge && (
            <button
              onClick={() => {
                if (!showFullContent) {
                  fetchContent(
                    `${objectApiUrl}/v1/objects/${bucketAddress}/${path}`,
                    size,
                  );
                }
                setShowFullContent(!showFullContent);
              }}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {showFullContent ? "Show Preview" : "Show Full Content"}
            </button>
          )}
        </div>
        {isLoadingContent ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <pre
            className={`text-muted-foreground max-h-[500px] min-h-12 overflow-auto border p-4 text-sm ${
              type === "application/json" ? "whitespace-pre" : ""
            }`}
          >
            {formattedContent}
            {isLarge && !showFullContent && (
              <div className="text-muted-foreground mt-2 text-sm">
                ... (Content truncated, {formatBytes(numericSize).formatted}{" "}
                total)
              </div>
            )}
          </pre>
        )}
      </div>
    );
  };

  if (object) {
    const objectSize = formatBytes(Number(object.size));
    const objectBlockDiff =
      blockNumber && !!object.expiry ? object.expiry - blockNumber : undefined;
    const expiryMillis = objectBlockDiff
      ? Date.now() + Number(numBlocksToSeconds(objectBlockDiff)) * 1000
      : undefined;
    const objectExpiryIso = expiryMillis
      ? new Date(expiryMillis).toLocaleString()
      : undefined;
    const objectExpiryDisplay =
      object.expiry === BigInt(0)
        ? "Never"
        : expiryMillis
          ? timeAgo.format(expiryMillis)
          : undefined;

    const contentType =
      object.metadata.find(
        (m: { key: string; value: string }) => m.key === "content-type",
      )?.value || detectedMimeType;

    return (
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-4">
            <File />
            {name}
            {deletePending || deleteReceiptFetching ? (
              <Loader2 className="ml-auto animate-spin" />
            ) : (
              <Trash
                className="hover:text-destructive ml-auto opacity-20 hover:cursor-pointer hover:opacity-100"
                onClick={handleDelete}
              />
            )}
            <Link
              href={`${objectApiUrl}/v1/objects/${bucketAddress}/${encodeURIComponent(path)}`}
              target="_blank"
              className="opacity-20 hover:cursor-pointer hover:opacity-100"
            >
              <Download />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-14 sm:grid-cols-2">
          <Metric
            title="Blob Hash"
            value={
              <CollapsedStringDisplay
                value={object.blobHash}
                showCopy
                copyTooltip="Copy blob hash"
                copySuccessMessage="Blob hash copied"
              />
            }
            valueTooltip={object.blobHash}
          />
          <Metric
            title="Recovery Hash"
            value={
              <CollapsedStringDisplay
                value={object.recoveryHash}
                showCopy
                copyTooltip="Copy recovery hash"
                copySuccessMessage="Recovery hash copied"
              />
            }
            valueTooltip={object.recoveryHash}
          />
          <Metric
            title="Size"
            value={objectSize.val}
            subtitle={objectSize.unit}
          />
          <Metric
            title={`Expire${(objectBlockDiff || 1) < 0 ? "d" : "s"}`}
            value={objectExpiryDisplay}
            valueTooltip={objectExpiryIso}
          />
          {contentType && <Metric title="Content Type" value={contentType} />}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-muted-foreground text-xs">Metadata</span>
            <pre className="text-muted-foreground min-h-12 border p-4 font-mono">
              {arrayToDisplay(object.metadata)}
            </pre>
          </div>
          {((contentType && PREVIEWABLE_TYPES.has(contentType)) ||
            (detectedMimeType && PREVIEWABLE_TYPES.has(detectedMimeType))) &&
            Number(object.size) <= MAX_PREVIEW_SIZE &&
            fileContent &&
            renderContent(
              fileContent,
              contentType || detectedMimeType || "application/json",
              object.size,
            )}
        </CardContent>
      </Card>
    );
  } else if (objectLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
}
