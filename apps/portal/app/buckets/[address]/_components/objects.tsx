"use client";

import { Loader2 } from "lucide-react";
import { Fragment, useEffect } from "react";
import { Address } from "viem";

import { useInfiniteQueryObjects } from "@recallnet/sdkx/react/buckets";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import { InfiniteScroll } from "@recallnet/ui/recall/infinite-scroll";

import FileListView from "./file-list-view";

interface ObjectResult {
  key: string;
  state: {
    blobHash: string;
    size: bigint;
    metadata: readonly {
      key: string;
      value: string;
    }[];
  };
}

interface PageResult {
  commonPrefixes: string[];
  objects: ObjectResult[];
}

interface QueryResult {
  pages: {
    result?: PageResult;
    error?: Error;
    status: "success" | "failure";
  }[];
}

export default function Objects({
  bucketAddress,
  path,
  delimiter,
}: {
  bucketAddress: Address;
  path: string;
  delimiter: string;
}) {
  const { toast } = useToast();

  const {
    data: objectsRes,
    error: objectsError,
    isLoading: objectsLoading,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQueryObjects(bucketAddress, {
    prefix: path,
    pageSize: 50,
    delimiter,
  }) as {
    data: QueryResult | undefined;
    error: Error | null;
    isLoading: boolean;
    hasNextPage: boolean;
    fetchNextPage: () => void;
  };

  useEffect(() => {
    if (objectsError) {
      toast({
        title: "Error",
        description: objectsError?.message,
      });
    }
  }, [toast, objectsError]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* <pre>{JSON.stringify(hasNextPage)}</pre>
      <pre>
        {JSON.stringify(
          objectsRes,
          (key, val) => (typeof val === "bigint" ? val.toString() : val),
          2,
        )}
      </pre> */}
      {objectsRes?.pages.map((page, num) => (
        <Fragment key={num}>
          <FileListView
            bucketAddress={bucketAddress}
            parentPath={path}
            delimiter={delimiter}
            commonPrefixes={page.result?.commonPrefixes || []}
            objects={page.result?.objects || []}
          />
        </Fragment>
      ))}
      {hasNextPage && !objectsLoading && (
        <InfiniteScroll
          key={objectsRes?.pages.length}
          hasMore={hasNextPage && !objectsLoading}
          onLoadMore={() => fetchNextPage()}
        />
      )}
      {!objectsLoading &&
        objectsRes?.pages.length === 1 &&
        !objectsRes.pages[0]?.result?.commonPrefixes.length &&
        !objectsRes.pages[0]?.result?.objects.length && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">This bucket is empty</p>
          </div>
        )}
      {objectsLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
    </div>
  );
}
