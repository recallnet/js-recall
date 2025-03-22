import TimeAgo from "javascript-time-ago";
import { Download, File, Loader2, Trash, ChevronDown, ChevronUp } from "lucide-react";
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
import FilePreview from "./file-preview";
import MetadataDisplay from "./metadata-display";

const timeAgo = new TimeAgo("en-US");

interface Props {
  bucketAddress: Address;
  name: string;
  path: string;
  parentPath: string;
  delimiter: string;
}

export default function Object({
  bucketAddress,
  name,
  path,
  parentPath,
  delimiter,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { address } = useAccount();
  const chainId = useChainId();
  const chain = getChain(chainId);
  const objectApiUrl = getObjectApiUrl(chain);

  const { data: blockNumber } = useBlockNumber();

  const {
    data: object,
    error: objectError,
    isLoading: objectLoading,
  } = useGetObject(bucketAddress, path);

  const {
    deleteObject,
    data: deleteTxnHash,
    error: deleteError,
    isPending: deletePending,
  } = useDeleteObject();

  const {
    isSuccess: deleteTxnSuccess,
    error: deleteTxnError,
    isLoading: deleteReceiptFetching,
  } = useWaitForTransactionReceipt({
    hash: deleteTxnHash,
  });

  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  useEffect(() => {
    if (objectError || deleteError || deleteTxnError) {
      toast({
        title: "Error",
        description:
          objectError?.message ||
          deleteError?.message ||
          deleteTxnError?.message,
        variant: "destructive",
      });
    }
  }, [toast, objectError, deleteError, deleteTxnError]);

  useEffect(() => {
    if (deleteTxnSuccess) {
      router.push(
        `/buckets/${bucketAddress}${parentPath ? `?path=${parentPath}` : ""}`,
      );
    }
  }, [bucketAddress, deleteTxnSuccess, parentPath, router]);

  const handleDelete = () => {
    if (!address) return;
    deleteObject({ owner: address, bucketAddress, key: path });
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

    const type = object.metadata.find((m) => m.key === "type")?.value;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-4 w-4" />
              {name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatBytes(object?.size || 0n).formatted}</span>
              <span>•</span>
              <span>Created: {object?.metadata.find((m) => m.key === "createdAt")?.value || "-"}</span>
              <span>•</span>
              <span>Updated: {object?.metadata.find((m) => m.key === "updatedAt")?.value || "-"}</span>
            </div>
            {object?.metadata && (
              <div className="mt-3">
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                >
                  <h3 className="text-sm font-medium">Additional Metadata</h3>
                  {isMetadataExpanded ? (
                    <ChevronUp className="h-4 w-4 opacity-50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  )}
                </div>
                {isMetadataExpanded && (
                  <div className="bg-muted/30 rounded-lg p-2 mt-2">
                    <MetadataDisplay
                      metadata={object.metadata.filter(m => !['createdAt', 'updatedAt'].includes(m.key))}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <FilePreview
          bucketAddress={bucketAddress}
          path={path}
          type={object?.metadata.find((m) => m.key === "type")?.value}
          className="mt-4"
        />
      </div>
    );
  } else if (objectLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return null;
}
