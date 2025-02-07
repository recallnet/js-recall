"use client";

import TimeAgo from "javascript-time-ago";
import { File, Folder, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect } from "react";
import { Address } from "viem";
import { useBlockNumber } from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import { numBlocksToSeconds } from "@recall/bigint-utils/conversions";
import { useGetObject, useQueryObjects } from "@recall/sdkx/react/buckets";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@recall/ui/components/breadcrumb";
import { Button } from "@recall/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recall/ui/components/card";
import { useToast } from "@recall/ui/hooks/use-toast";
import { cn } from "@recall/ui/lib/utils";
import CollapsedStringDisplay from "@recall/ui/recall/collapsed-string-display";

import Metric from "@/app/account/_components/metric";
import { formatBytes } from "@/lib/format-bytes";
import { removePrefix } from "@/lib/remove-prefix";

import ObjectCard from "./object-card";

const timeAgo = new TimeAgo("en-US");

export default function Bucket({
  bucketAddress,
  prefixParts,
}: {
  bucketAddress: Address;
  prefixParts: string[];
}) {
  const searchParams = useSearchParams();

  const { toast } = useToast();

  const { data: blockNumber } = useBlockNumber();

  const isObject = searchParams.has("object");
  let prefix = prefixParts.join("/");
  prefix = !prefix
    ? ""
    : !isObject && prefixParts.length
      ? prefix + "/"
      : prefix;

  const {
    data: objects,
    error: objectsError,
    isLoading: objectsLoading,
  } = useQueryObjects(bucketAddress, {
    prefix,
    enabled: !isObject,
  });

  const {
    data: object,
    error: objectError,
    isLoading: objectLoading,
  } = useGetObject(bucketAddress, prefix, {
    enabled: isObject,
  });

  useEffect(() => {
    if (objectsError || objectError) {
      toast({
        title: "Error",
        description: objectsError?.message || objectError?.message,
      });
    }
  }, [objectsError, objectError, toast]);

  const objectSize = object?.size
    ? formatBytes(Number(object.size))
    : undefined;

  const objectBlockDiff =
    blockNumber && !!object?.expiry ? object.expiry - blockNumber : undefined;
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

  const pending = objectsLoading || objectLoading;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-end gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/buckets`}>Buckets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {prefixParts.length ? (
                <BreadcrumbLink href={`/buckets/${bucketAddress}`}>
                  {displayAddress(bucketAddress)}
                </BreadcrumbLink>
              ) : (
                displayAddress(bucketAddress)
              )}
            </BreadcrumbItem>
            {prefixParts.map((part, index) => (
              <Fragment key={part}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === prefixParts.length - 1 ? (
                    part
                  ) : (
                    <BreadcrumbLink
                      href={`/buckets/${bucketAddress}/${prefixParts.slice(0, index + 1).join("/")}`}
                    >
                      {part}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <Button
          variant="secondary"
          onClick={() => {}}
          className={cn("ml-auto", isObject && "invisible")}
        >
          Add Object
        </Button>
      </div>
      {objects?.commonPrefixes.map((commonPrefix) => (
        <Card key={commonPrefix} className="rounded-none">
          <CardHeader>
            <CardTitle>
              <Link
                key={commonPrefix}
                href={`/buckets/${bucketAddress}/${commonPrefix}`}
                className="flex items-center gap-4 justify-self-start"
              >
                <Folder />
                {removePrefix(commonPrefix, prefix).slice(0, -1)}
              </Link>
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
      {objects?.objects.map((object) => (
        <ObjectCard
          key={object.key}
          bucketAddress={bucketAddress}
          prefix={prefix}
          object={object}
        />
      ))}
      {object && objectSize && (
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <File />
              {prefixParts[prefixParts.length - 1]}
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
                {JSON.stringify(object.metadata, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
      {!pending &&
        !objects?.commonPrefixes.length &&
        !objects?.objects.length &&
        !object && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">This bucket is empty</p>
          </div>
        )}
      {pending && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
    </div>
  );
}
