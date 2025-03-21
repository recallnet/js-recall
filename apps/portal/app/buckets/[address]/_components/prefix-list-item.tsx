import { Folder } from "lucide-react";
import Link from "next/link";
import { Address } from "viem";

import { Card, CardHeader, CardTitle } from "@recallnet/ui/components/card";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@recallnet/ui/lib/utils";

import { removePrefix } from "@/lib/remove-prefix";

interface Props {
  bucketAddress: Address;
  parentPath: string;
  commonPrefix: string;
  delimiter: string;
  viewMode?: "list" | "grid";
}

export default function PrefixListItem({
  bucketAddress,
  parentPath,
  commonPrefix,
  delimiter,
  viewMode = "list",
}: Props) {
  const displayName = removePrefix(commonPrefix, parentPath);

  return (
    <Card className="rounded-none hover:bg-accent/5 transition-colors truncate">
      <CardHeader className="relative px-6 py-3">
        <CardTitle>
          <Link
            href={{
              pathname: `/buckets/${bucketAddress}`,
              query: {
                path: commonPrefix,
                ...(delimiter !== "/" ? { delimiter } : {}),
              },
            }}
            className="flex items-center gap-4 min-w-0"
            title={displayName}
          >
            <Folder className="flex-shrink-0 text-primary" />
            <div className={cn(
              viewMode === "grid" ? "flex flex-col gap-1 min-w-0" : "flex-1 min-w-0"
            )}>
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="truncate font-medium leading-6 font-mono">
                      {displayName}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                      side="top"
                    >
                      <p>{displayName}</p>
                      <Tooltip.Arrow className="fill-popover" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
              {viewMode === "grid" && (
                <span className="text-xs text-muted-foreground">Folder</span>
              )}
            </div>
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
