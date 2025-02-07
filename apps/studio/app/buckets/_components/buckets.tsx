"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";

import { useCreateBucket, useListBuckets } from "@recall/sdkx/react/buckets";
import { Button } from "@recall/ui/components/button";
import { useToast } from "@recall/ui/hooks/use-toast";

import BucketCard from "./bucket-card";

export default function Buckets() {
  const { toast } = useToast();

  const {
    data: buckets,
    refetch: refetchBuckets,
    error: listBucketsError,
    isLoading: listBucketsLoading,
  } = useListBuckets();

  const {
    createBucket,
    data: createBucketTxnHash,
    error: createBucketError,
  } = useCreateBucket();

  const { isSuccess: createBucketTxnSuccess, error: createBucketTxnError } =
    useWaitForTransactionReceipt({
      hash: createBucketTxnHash,
    });

  useEffect(() => {
    if (createBucketTxnSuccess) {
      refetchBuckets();
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

  const pending = listBucketsLoading;

  const handleCreateBucket = () => {
    createBucket();
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Button
        variant="secondary"
        onClick={handleCreateBucket}
        className="self-end"
      >
        Create Bucket
      </Button>
      {buckets?.map((bucket) => (
        <BucketCard key={bucket.addr} bucket={bucket} />
      ))}
      {pending && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {/* <pre>Buckets: {JSON.stringify(buckets, null, 2)}</pre> */}
    </div>
  );
}
