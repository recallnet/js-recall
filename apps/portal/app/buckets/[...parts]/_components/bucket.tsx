"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Address } from "viem";

import { displayAddress } from "@recallnet/address-utils/display";
import { useCreditAccount } from "@recallnet/sdkx/react/credits";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@recallnet/ui/components/breadcrumb";
import { Button } from "@recallnet/ui/components/button";
import { cn } from "@recallnet/ui/lib/utils";

import AddObjectDialog from "./add-object-dialog";
import CreditNeededDialog from "./credit-needed-dialog";
import Object from "./object";
import Objects from "./objects";

export default function Bucket({
  bucketAddress,
  prefixParts,
}: {
  bucketAddress: Address;
  prefixParts: string[];
}) {
  const searchParams = useSearchParams();

  const isObject = searchParams.has("object");
  const prefix =
    prefixParts.join("/") + (prefixParts.length && !isObject ? "/" : "");

  const [addObjectOpen, setAddObjectOpen] = useState(false);
  const [creditNeededOpen, setCreditNeededOpen] = useState(false);

  const { data: creditAccount } = useCreditAccount();

  const handleAddObject = () => {
    if (creditAccount?.creditFree === 0n) {
      setCreditNeededOpen(true);
    } else {
      setAddObjectOpen(true);
    }
  };

  function mainContent() {
    if (isObject) {
      const name = prefixParts[prefixParts.length - 1] ?? "unknown";
      const containingPrefix = prefixParts.slice(0, -1).join("/");
      return (
        <Object
          bucketAddress={bucketAddress}
          name={name}
          prefix={prefix}
          containingPrefix={containingPrefix}
        />
      );
    } else {
      return <Objects bucketAddress={bucketAddress} prefix={prefix} />;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AddObjectDialog
        open={addObjectOpen}
        onOpenChange={setAddObjectOpen}
        bucketAddress={bucketAddress}
        prefix={prefix}
      />
      <CreditNeededDialog
        open={creditNeededOpen}
        onOpenChange={setCreditNeededOpen}
      />
      <div className="flex items-end gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/buckets">Buckets</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {prefixParts.length ? (
                <BreadcrumbLink asChild>
                  <Link href={`/buckets/${bucketAddress}`}>
                    {displayAddress(bucketAddress)}
                  </Link>
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
                    <BreadcrumbLink asChild>
                      <Link
                        href={`/buckets/${bucketAddress}/${prefixParts.slice(0, index + 1).join("/")}`}
                      >
                        {part}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <Button
          variant="secondary"
          onClick={handleAddObject}
          className={cn("ml-auto", isObject && "invisible")}
        >
          Add Object
        </Button>
      </div>
      {mainContent()}
    </div>
  );
}
