"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";

import {
  useCreateBucket,
  useListBuckets,
  useQueryObjects,
} from "@recall/sdkx/react/buckets";
import { Button } from "@recall/ui/components/button";
import { useToast } from "@recall/ui/hooks/use-toast";

export default function Buckets() {
  const { toast } = useToast();

  const {
    data,
    refetch: refetchBuckets,
    error: listBucketsError,
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

  const handleCreateBucket = () => {
    createBucket();
  };

  return (
    <div>
      <Button onClick={handleCreateBucket}>Create Bucket</Button>
      <pre>Buckets: {JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
