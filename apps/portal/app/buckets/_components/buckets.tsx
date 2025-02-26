"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";

import { useCreateBucket, useListBuckets } from "@recallnet/sdkx/react/buckets";
import { Button } from "@recallnet/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/dialog";
import { Label } from "@recallnet/ui/components/label";
import { Textarea } from "@recallnet/ui/components/textarea";
import { useToast } from "@recallnet/ui/hooks/use-toast";

import { dislpayToRecord } from "@/lib/convert-matadata";

import BucketCard from "./bucket-card";

export default function Buckets() {
  const { toast } = useToast();
  const [newBucketOpen, setNewBucketOpen] = useState(false);
  const [metadata, setMetadata] = useState("");

  const { address } = useAccount();

  const {
    data: buckets,
    refetch: refetchBuckets,
    error: listBucketsError,
    isPending: listBucketsPending,
  } = useListBuckets();

  const {
    createBucket,
    data: createBucketTxnHash,
    error: createBucketError,
    isPending: createBucketPending,
  } = useCreateBucket();

  const {
    isSuccess: createBucketTxnSuccess,
    error: createBucketTxnError,
    isLoading: createBucketTxnLoading,
  } = useWaitForTransactionReceipt({
    hash: createBucketTxnHash,
  });

  useEffect(() => {
    if (createBucketTxnSuccess) {
      refetchBuckets();
      setNewBucketOpen(false);
    }
  }, [createBucketTxnSuccess, refetchBuckets]);

  useEffect(() => {
    if (listBucketsError || createBucketError || createBucketTxnError) {
      toast({
        title: "Error",
        description:
          listBucketsError?.message ||
          createBucketError?.message ||
          createBucketTxnError?.message,
        variant: "destructive",
      });
    }
  }, [createBucketError, createBucketTxnError, listBucketsError, toast]);

  const createPending = createBucketPending || createBucketTxnLoading;

  const handleCreateBucket = () => {
    if (!address) return;
    try {
      const jsonMetadata = dislpayToRecord(metadata);
      createBucket({ owner: address, metadata: jsonMetadata });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create bucket",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Dialog open={newBucketOpen} onOpenChange={setNewBucketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bucket</DialogTitle>
          </DialogHeader>
          <Label htmlFor="metadata">Metadata</Label>
          <Textarea
            id="metadata"
            onChange={(e) => setMetadata(e.target.value)}
            placeholder={JSON.stringify(
              { key1: "value1", key2: "value2", "...": "..." },
              null,
              2,
            )}
            className="min-h-32"
          />
          <span className="text-muted-foreground text-xs">
            Metadata is optional and must be a JSON object with string property
            values.
          </span>
          <DialogFooter>
            <Button onClick={handleCreateBucket} disabled={createPending}>
              Submit {createPending && <Loader2 className="animate-spin" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="secondary"
        onClick={() => setNewBucketOpen(true)}
        className="self-end"
      >
        New Bucket
      </Button>
      {buckets?.map((bucket) => (
        <BucketCard key={bucket.addr} bucket={bucket} />
      ))}
      {listBucketsPending && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {!listBucketsPending && !buckets?.length && (
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          No buckets to display.
        </div>
      )}
    </div>
  );
}
