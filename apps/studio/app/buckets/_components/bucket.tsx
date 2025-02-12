"use client";

import { useMutation } from "@tanstack/react-query";
import { default as axios } from "axios";
import TimeAgo from "javascript-time-ago";
import { File, Folder, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { FileWithPath, useDropzone } from "react-dropzone";
import { Address } from "viem";
import { useBlockNumber, useWaitForTransactionReceipt } from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import {
  hoursToNumBlocks,
  numBlocksToSeconds,
} from "@recall/bigint-utils/conversions";
import {
  useAddObject,
  useGetObject,
  useQueryObjects,
} from "@recall/sdkx/react/buckets";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recall/ui/components/dialog";
import { Input } from "@recall/ui/components/input";
import { Label } from "@recall/ui/components/label";
import { Progress } from "@recall/ui/components/progress";
import { Switch } from "@recall/ui/components/switch";
import { Textarea } from "@recall/ui/components/textarea";
import { useToast } from "@recall/ui/hooks/use-toast";
import { cn } from "@recall/ui/lib/utils";
import CollapsedStringDisplay from "@recall/ui/recall/collapsed-string-display";

import Metric from "@/app/account/_components/metric";
import { arrayToDisplay, dislpayToRecord } from "@/lib/convert-matadata";
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

  const isObject = searchParams.has("object");
  let prefix = prefixParts.join("/");
  prefix = !prefix
    ? ""
    : !isObject && prefixParts.length
      ? prefix + "/"
      : prefix;

  const [addObjectOpen, setAddObjectOpen] = useState(false);
  const [key, setKey] = useState(prefix);
  const [overwrite, setOverwrite] = useState(false);
  const [ttl, setTtl] = useState("");
  const [metadata, setMetadata] = useState<string>("");
  const [file, setFile] = useState<FileWithPath | undefined>(undefined);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    onDrop: (files) => setFile(files[0]),
  });

  const { toast } = useToast();

  const { data: blockNumber } = useBlockNumber();

  const {
    data: objects,
    error: objectsError,
    isLoading: objectsLoading,
    refetch: refetchObjects,
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
    if (!addObjectOpen) {
      setKey(prefix);
      setOverwrite(false);
      setMetadata("");
      setFile(undefined);
      setProgress(undefined);
    }
  }, [addObjectOpen, prefix]);

  useEffect(() => {
    if (file) {
      const metaObj = {
        ...dislpayToRecord(metadata || "{}"),
        ...(file.type && { type: file.type }),
        ...(file.size && { size: file.size }),
      };
      setMetadata(JSON.stringify(metaObj, null, 2));
    }
  }, [file, metadata]);

  const {
    addObject,
    data: addObjectTxnHash,
    isPending: addObjectPending,
    error: addObjectError,
  } = useAddObject();

  const { isPending: addObjectReceiptPending, data: addObjectReceipt } =
    useWaitForTransactionReceipt({
      hash: addObjectTxnHash,
    });

  const handleSubmit = async () => {
    if (!file) {
      throw new Error("No file selected");
    }
    const f = new FormData();
    f.append("data", file);
    f.append("size", file.size.toString());

    const res = await axios.post<{ hash: string; metadata_hash: string }>(
      "/api/objects",
      f,
      {
        onUploadProgress: (e) => {
          const progress = e.total
            ? Math.round((e.loaded * 100) / e.total)
            : undefined;
          setProgress(progress);
        },
      },
    );
    const nodeInfo = await axios.get<{
      node_id: string;
      info: {
        relay_url: string;
        direct_addresses: string[];
      };
    }>("https://objects.node-0.testnet.recall.network/v1/node");
    return { ...res.data, ...nodeInfo.data };
  };

  const {
    mutate: upload,
    data: uploadRes,
    isPending: uploadPending,
    isSuccess: uploadSuccess,
    error: uploadError,
  } = useMutation({
    mutationFn: handleSubmit,
  });

  useEffect(() => {
    if (uploadRes && file) {
      addObject(
        bucketAddress,
        key,
        uploadRes.node_id,
        uploadRes.hash,
        BigInt(file.size),
        {
          metadata: metadata ? dislpayToRecord(metadata) : undefined,
          overwrite: overwrite || undefined,
          ttl: ttl ? hoursToNumBlocks(ttl) : undefined,
        },
      );
    }
  }, [
    bucketAddress,
    key,
    file,
    uploadRes,
    metadata,
    overwrite,
    ttl,
    addObject,
  ]);

  useEffect(() => {
    if (addObjectReceipt) {
      refetchObjects();
      setAddObjectOpen(false);
      setKey(prefix);
      setOverwrite(false);
      setMetadata("");
      setFile(undefined);
      setProgress(undefined);
    }
  }, [addObjectReceipt, prefix, refetchObjects]);

  useEffect(() => {
    if (objectsError || objectError || uploadError || addObjectError) {
      toast({
        title: "Error",
        description:
          objectsError?.message ||
          objectError?.message ||
          uploadError?.message ||
          addObjectError?.message,
      });
    }
  }, [toast, objectsError, objectError, uploadError, addObjectError]);

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

  const objectsPending = objectsLoading || objectLoading;
  const addPending =
    uploadPending ||
    addObjectPending ||
    (!!addObjectTxnHash && addObjectReceiptPending);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Dialog open={addObjectOpen} onOpenChange={setAddObjectOpen}>
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add Object</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              placeholder="prefix/my-object"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="overwrite">Overwrite</Label>
              <Switch
                id="overwrite"
                checked={overwrite}
                onCheckedChange={setOverwrite}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <div
              {...getRootProps()}
              className={cn(
                "focus-visible:ring-ring flex flex-col items-center gap-6 border border-dashed p-6 text-center hover:cursor-pointer focus-visible:outline-none focus-visible:ring-1",
                isDragActive && "bg-accent",
              )}
            >
              <Input id="file" {...getInputProps()} />
              {file ? (
                <p className="text-sm">{file.name}</p>
              ) : (
                <p
                  className={cn(
                    "text-muted-foreground mt-0 text-sm",
                    isDragActive && "text-accent-foreground",
                  )}
                >
                  Drag and drop a file here, or click to select a file.
                </p>
              )}
              {(uploadPending || uploadSuccess) && (
                <Progress value={progress} className="h-1" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="metadata">Metadata</Label>
            <Textarea
              id="metadata"
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder={JSON.stringify(
                { key1: "value1", key2: "value2", "...": "..." },
                null,
                2,
              )}
              className="min-h-32"
            />
            <p className="text-muted-foreground text-xs">
              Metadata is optional and must be a JSON object with string
              property values.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ttl">TTL (Hours)</Label>
            <Input
              id="ttl"
              type="number"
              min={1}
              placeholder="default"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => upload()} disabled={addPending}>
              Submit {addPending && <Loader2 className="animate-spin" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          onClick={() => setAddObjectOpen(true)}
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
                {arrayToDisplay(object.metadata)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
      {!objectsPending &&
        !objects?.commonPrefixes.length &&
        !objects?.objects.length &&
        !object && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">This bucket is empty</p>
          </div>
        )}
      {objectsPending && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
    </div>
  );
}
