"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useChainId } from "wagmi";

import { getChain, getObjectApiUrl } from "@recallnet/chains";
import { Button } from "@recallnet/ui/components/button";
import { toast } from "@recallnet/ui/hooks/use-toast";

import { FilePreviewerProps } from "./types";

/**
 * Plain text file previewer component
 * Renders text content with syntax highlighting
 */
export function PlainTextPreview({
  bucketAddress,
  path,
  chainId,
}: Pick<FilePreviewerProps, 'bucketAddress' | 'path'> & { chainId?: number }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hookChainId = useChainId();
  // Use chainId from props if provided, otherwise use the one from hook
  const effectiveChainId = chainId ?? hookChainId;

  // Function to fetch and set the text content
  async function fetchTextContent() {
    setLoading(true);
    setError(null);

    try {
      // Get proper API URL for the chain
      const objectApiUrl = getObjectApiUrl(getChain(effectiveChainId));

      // Construct the endpoint URL without encoding the path
      const url = `${objectApiUrl}/v1/objects/${bucketAddress}/${path}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }

      // For plain text files, we can convert the response directly to text
      const text = await response.text();
      setContent(text);
    } catch (err) {
      console.error("Error fetching text content:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load file content",
      );
      toast({
        title: "Error loading file",
        description:
          err instanceof Error ? err.message : "Failed to load file content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Fetch content on component mount and when dependencies change
  useEffect(() => {
    fetchTextContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketAddress, path, effectiveChainId]); // We're not including fetchTextContent to avoid recreation on each render

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full min-h-[300px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Loading file content...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-destructive">Failed to load file content</div>
        <p className="text-muted-foreground max-w-md text-sm">{error}</p>
        <Button variant="outline" onClick={fetchTextContent} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Content display
  return (
    <div className="h-full w-full overflow-auto">
      <pre className="whitespace-pre-wrap break-all p-4 text-sm">{content}</pre>
    </div>
  );
}
