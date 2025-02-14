import TimeAgo from "javascript-time-ago";
import { Download, File, Loader2, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Address } from "viem";
import { useBlockNumber, useWaitForTransactionReceipt } from "wagmi";

import { numBlocksToSeconds } from "@recall/bigint-utils/conversions";
import { useDeleteObject } from "@recall/sdkx/react/buckets";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recall/ui/components/card";
import CollapsedStringDisplay from "@recall/ui/recall/collapsed-string-display";

import Metric from "@/app/account/_components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";
import { formatBytes } from "@/lib/format-bytes";

const timeAgo = new TimeAgo("en-US");

interface Props {
  bucketAddress: Address;
  prefixParts: string[];
  object: {
    blobHash: string;
    recoveryHash: string;
    size: bigint;
    expiry: bigint;
    metadata: readonly {
      key: string;
      value: string;
    }[];
  };
}

export default function Object({ bucketAddress, prefixParts, object }: Props) {
  const router = useRouter();

  const { data: blockNumber } = useBlockNumber();

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
      router.replace(
        `/buckets/${bucketAddress}/${prefixParts.slice(0, -1).join("/")}`,
      );
    }
  }, [bucketAddress, deleteReceipt, prefixParts, router]);

  const handleDelete = () => {
    deleteObject(bucketAddress, prefixParts.join("/"));
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/objects/${object.blobHash}`;
    a.download = object.blobHash;
    a.click();
  };

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
    object?.expiry === BigInt(0)
      ? "Never"
      : expiryMillis
        ? timeAgo.format(expiryMillis)
        : undefined;

  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <File />
          {prefixParts[prefixParts.length - 1] || ""}
          {deletePending || deleteReceiptFetching ? (
            <Loader2 className="ml-auto animate-spin" />
          ) : (
            <Trash
              className="text-destructive ml-auto opacity-40 hover:cursor-pointer hover:opacity-100"
              onClick={handleDelete}
            />
          )}
          <Link
            href={`https://objects.node-0.testnet.recall.network/v1/objects/${bucketAddress}/${prefixParts.join("/")}`}
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
}
