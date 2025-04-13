"use client";

import { Loader2 } from "lucide-react";
import { Fragment, useEffect } from "react";
import { Address } from "viem";

import { useInfiniteQueryObjects } from "@recallnet/sdkx/react/buckets";
import { InfiniteScroll } from "@recallnet/ui/components/infinite-scroll";
import { toast } from "@recallnet/ui/components/toast";

import ObjectListItem from "./object-list-item";
import PrefixListItem from "./prefix-list-item";

export default function Objects({
  bucketAddress,
  path,
  delimiter,
}: {
  bucketAddress: Address;
  path: string;
  delimiter: string;
}) {
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
  });

  useEffect(() => {
    if (objectsError) {
      toast.error("Error", {
        description: objectsError?.message,
      });
    }
  }, [objectsError]);

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
              parentPath={path}
              commonPrefix={commonPrefix}
              delimiter={delimiter}
            />
          ))}
          {page.result?.objects.map((object) => (
            <ObjectListItem
              key={object.key}
              bucketAddress={bucketAddress}
              parentPath={path}
              object={object}
              delimiter={delimiter}
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
