"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Address } from "viem";

import { displayAddress } from "@recall/address-utils/display";
import { useGetObject, useQueryObjects } from "@recall/sdkx/react/buckets";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@recall/ui/components/breadcrumb";
import { Button } from "@recall/ui/components/button";
import { useToast } from "@recall/ui/hooks/use-toast";
import { cn } from "@recall/ui/lib/utils";

import { removePrefix } from "@/lib/remove-prefix";

import AddObjectDialog from "./add-object-dialog";
import Object from "./object";
import ObjectListItem from "./object-list-item";
import PrefixListItem from "./prefix-list-item";

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

  const { toast } = useToast();

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
  }, [toast, objectsError, objectError]);

  const objectsPending = objectsLoading || objectLoading;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AddObjectDialog
        open={addObjectOpen}
        onOpenChange={setAddObjectOpen}
        bucketAddress={bucketAddress}
        prefix={prefix}
      />
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
        <PrefixListItem
          key={commonPrefix}
          bucketAddress={bucketAddress}
          commonPrefix={commonPrefix}
          label={removePrefix(commonPrefix, prefix).slice(0, -1)}
        />
      ))}
      {objects?.objects.map((object) => (
        <ObjectListItem
          key={object.key}
          bucketAddress={bucketAddress}
          prefix={prefix}
          object={object}
        />
      ))}
      {object && (
        <Object
          bucketAddress={bucketAddress}
          prefixParts={prefixParts}
          object={object}
        />
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
