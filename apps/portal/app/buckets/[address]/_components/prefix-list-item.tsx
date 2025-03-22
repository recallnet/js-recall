import { Folder } from "lucide-react";
import Link from "next/link";
import { Address } from "viem";

import { Card, CardHeader, CardTitle } from "@recallnet/ui/components/card";
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
          >
            <Folder className="flex-shrink-0 text-primary" />
            <div className={cn(
              viewMode === "grid" ? "flex flex-col gap-1 min-w-0" : "flex-1 min-w-0"
            )}>
              <div className="truncate font-medium leading-6 font-mono">
                {displayName}
              </div>
            </div>
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
