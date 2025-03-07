"use client";

import { Loader2 } from "lucide-react";
import { Fragment, useEffect } from "react";
import { Address } from "viem";

import { useInfiniteQueryObjects } from "@recallnet/sdkx/react/buckets";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import { InfiniteScroll } from "@recallnet/ui/recall/infinite-scroll";

import { removePrefix } from "@/lib/remove-prefix";

import ObjectListItem from "./object-list-item";
import PrefixListItem from "./prefix-list-item";

export default function Objects({
  bucketAddress,
  prefix,
}: {
  bucketAddress: Address;
  prefix: string;
}) {
  const { toast } = useToast();

  const {
    data: objectsRes,
    error: objectsError,
    isLoading: objectsLoading,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQueryObjects(bucketAddress, {
    prefix,
    pageSize: 50,
  });

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
          {page.result?.commonPrefixes.map((commonPrefix) => (
            <PrefixListItem
              key={commonPrefix}
              bucketAddress={bucketAddress}
              commonPrefix={commonPrefix}
              label={removePrefix(commonPrefix, prefix).slice(0, -1)}
            />
          ))}
          {page.result?.objects.map((object) => (
            <ObjectListItem
              key={object.key}
              bucketAddress={bucketAddress}
              prefix={prefix}
              object={object}
            />
          ))}
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
