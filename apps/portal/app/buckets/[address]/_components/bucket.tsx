"use client";

import { File } from "lucide-react";
import { duration } from "moment";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Address } from "viem";

import { displayAddress } from "@recallnet/address-utils/display";
import { numBlocksToSeconds } from "@recallnet/bigint-utils/conversions";
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

import { CopyButton } from "@/components/copy-button";

import AddObjectDialog from "./add-object-dialog";
import CreditNeededDialog from "./credit-needed-dialog";
import Object from "./object";
import Objects from "./objects";

export default function Bucket({ bucketAddress }: { bucketAddress: Address }) {
  const searchParams = useSearchParams();

  const [delimiter] = useState(
    searchParams.get("delimiter") || "/",
  );

  const path = searchParams.get("path") || "";
  const isObject = path && !path.endsWith(delimiter);
  const pathParts = path
    ? path.split(delimiter).slice(0, isObject ? undefined : -1)
    : [];

  const [addObjectOpen, setAddObjectOpen] = useState(false);
  const [creditNeededOpen, setCreditNeededOpen] = useState(false);

  const { data: creditAccount } = useCreditAccount();

  const maxTtlDisplay = creditAccount
    ? creditAccount.maxTtl
      ? duration(
          Number(numBlocksToSeconds(creditAccount.maxTtl)) * 1000,
        ).humanize()
      : "None"
    : "Unknown";

  const handleAddObject = () => {
    if (creditAccount?.creditFree === 0n) {
      setCreditNeededOpen(true);
    } else {
      setAddObjectOpen(true);
    }
  };

  function mainContent() {
    if (isObject) {
      const name = pathParts[pathParts.length - 1] ?? "unknown";
      const parentPath =
        pathParts.slice(0, -1).join(delimiter) +
        (pathParts.length > 1 ? delimiter : "");
      return (
        <Object
          bucketAddress={bucketAddress}
          name={name}
          path={path}
          parentPath={parentPath}
          delimiter={delimiter}
        />
      );
    } else {
      return (
        <Objects
          bucketAddress={bucketAddress}
          path={path}
          delimiter={delimiter}
        />
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AddObjectDialog
        key={`${addObjectOpen}`}
        open={addObjectOpen}
        onOpenChange={setAddObjectOpen}
        bucketAddress={bucketAddress}
        prefix={path}
        defaultTTLString={maxTtlDisplay}
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
              {pathParts.length ? (
                <BreadcrumbLink asChild>
                  <Link
                    href={{
                      pathname: `/buckets/${bucketAddress}`,
                      ...(delimiter !== "/" ? { query: { delimiter } } : {}),
                    }}
                  >
                    {displayAddress(bucketAddress)}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <div className="text-foreground flex items-center gap-2 font-semibold">
                  {displayAddress(bucketAddress)}
                  <CopyButton
                    value={bucketAddress}
                    tooltip="Copy bucket ID"
                    successMessage="Bucket ID copied to clipboard"
                    className="opacity-40 hover:opacity-100"
                  />
                </div>
              )}
            </BreadcrumbItem>
            {!!pathParts.length && <BreadcrumbSeparator />}
            {pathParts.map((part, index) => (
              <Fragment key={`${index}-${part}`}>
                <BreadcrumbItem>
                  {index === pathParts.length - 1 ? (
                    <div className="text-foreground flex items-center gap-2 font-semibold">
                      <File className="text-primary mr-1 size-4" />
                      {part || "\u00A0\u00A0"}
                      <CopyButton
                        value={part}
                        tooltip={
                          isObject ? "Copy filename" : "Copy directory name"
                        }
                        successMessage={`${isObject ? "Filename" : "Directory name"} copied to clipboard`}
                        className="opacity-40 hover:opacity-100"
                      />
                    </div>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={{
                          pathname: `/buckets/${bucketAddress}`,
                          query: {
                            path: `${pathParts.slice(0, index + 1).join(delimiter)}${delimiter}`,
                            ...(delimiter !== "/" ? { delimiter } : {}),
                          },
                        }}
                      >
                        {part || "\u00A0\u00A0"}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {(index < pathParts.length - 1 || !isObject) && (
                  <BreadcrumbSeparator>{delimiter}</BreadcrumbSeparator>
                )}
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
