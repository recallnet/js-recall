import TimeAgo from "javascript-time-ago";
import { Download, Loader2, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Address } from "viem";
import {
  useAccount,
  useBlockNumber,
  useChainId,
  useWaitForTransactionReceipt,
} from "wagmi";

import { numBlocksToSeconds } from "@recallnet/bigint-utils/conversions";
import { getChain, getObjectApiUrl } from "@recallnet/chains";
import { useDeleteObject, useGetObject } from "@recallnet/sdkx/react/buckets";
import { Card } from "@recallnet/ui/components/card";
import { useToast } from "@recallnet/ui/hooks/use-toast";

import { CopyButton } from "@/components/copy-button";
import { FilePreviewer } from "@/components/file-previewers/file-previewer";
import { formatBytes } from "@/lib/format-bytes";

import { MetadataPanel } from "./metadata-panel";

const timeAgo = new TimeAgo("en-US");

interface Props {
  bucketAddress: Address;
  path: string;
  parentPath: string;
  delimiter: string;
}

export default function Object({
  bucketAddress,
  path,
  parentPath,
  delimiter,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const { address: fromAddress } = useAccount();

  const chainId = useChainId();

  const { data: blockNumber } = useBlockNumber();

  const {
    data: object,
    error: objectError,
    isLoading: objectLoading,
  } = useGetObject(bucketAddress, path);

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

  const handleDelete = () => {
    if (fromAddress === undefined) return;
    deleteObject(bucketAddress, fromAddress, path);
  };

  const objectApiUrl = getObjectApiUrl(getChain(chainId));

  const getPortalShareUrl = () => {
    return typeof window !== "undefined" ? window.location.toString() : "";
  };

  // Helper function to construct object URLs consistently
  const constructObjectUrl = (apiUrl: string, bucket: string, objectPath: string) => {
    return `${apiUrl}/v1/objects/${bucket}/${objectPath}`;
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

    const contentTypeMetadata = object.metadata.find(
      (item) => item.key.toLowerCase() === "content-type",
    );
    const contentType = contentTypeMetadata?.value;

    const fileName = path.split(delimiter).pop() || path;

    return (
      <Card className="flex flex-col rounded-none">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <span>{objectSize.formatted}</span>
            <span>
              Expires {objectBlockDiff && objectBlockDiff < 0n ? "d" : ""}{" "}
              {objectExpiryDisplay}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {deletePending || deleteReceiptFetching ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <div title="Delete object">
                <Trash
                  className="hover:text-destructive size-5 opacity-20 hover:cursor-pointer hover:opacity-100"
                  onClick={handleDelete}
                />
              </div>
            )}
            <Link
              href={constructObjectUrl(objectApiUrl, bucketAddress, path)}
              target="_blank"
              title="Download object"
            >
              <Download className="size-5 opacity-20 hover:cursor-pointer hover:opacity-100" />
            </Link>
            <CopyButton
              type="share"
              value={getPortalShareUrl()}
              tooltip="Copy portal link to share"
              successMessage="Portal link copied to clipboard"
              className="size-5"
            />
          </div>
        </div>

        <div className="min-h-[400px] flex-1 p-4">
          <FilePreviewer
            bucketAddress={bucketAddress}
            path={path}
            fileName={fileName}
            contentType={contentType}
            size={object.size}
            expiry={object.expiry}
            metadata={object.metadata}
          />
        </div>

        <MetadataPanel
          object={object}
          objectSize={{ ...objectSize, unit: objectSize.unit ?? "" }}
          objectExpiryDisplay={objectExpiryDisplay}
          objectExpiryIso={objectExpiryIso}
          objectBlockDiff={objectBlockDiff}
        />
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
