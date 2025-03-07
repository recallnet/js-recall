import TimeAgo from "javascript-time-ago";
import { Download, File, Loader2, Trash } from "lucide-react";
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

interface Props {
  bucketAddress: Address;
  name: string;
  prefix: string;
  containingPrefix: string;
}

export default function Object({
  bucketAddress,
  name,
  prefix,
  containingPrefix,
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
  } = useGetObject(bucketAddress, prefix);

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
      router.replace(`/buckets/${bucketAddress}/${containingPrefix}`);
    }
  }, [bucketAddress, deleteReceipt, containingPrefix, router]);

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
    deleteObject(bucketAddress, fromAddress, prefix);
  };

  const objectApiUrl = getObjectApiUrl(getChain(chainId));

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
              href={`${objectApiUrl}/v1/objects/${bucketAddress}/${prefix}`}
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
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-muted-foreground text-xs">Metadata</span>
            <pre className="text-muted-foreground min-h-12 border p-4">
              {arrayToDisplay(object.metadata)}
            </pre>
          </div>
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
