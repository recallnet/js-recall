import { Folder } from "lucide-react";
import Link from "next/link";
import { Address } from "viem";

import { Card, CardHeader, CardTitle } from "@recallnet/ui/components/card";

import { removePrefix } from "@/lib/remove-prefix";

interface Props {
  bucketAddress: Address;
  parentPath: string;
  commonPrefix: string;
  delimiter: string;
}

export default function PrefixListItem({
  bucketAddress,
  parentPath,
  commonPrefix,
  delimiter,
}: Props) {
  return (
    <Card key={commonPrefix} className="rounded-none hover:bg-accent/5 transition-colors truncate">
      <CardHeader>
        <CardTitle>
          <Link
            key={commonPrefix}
            href={{
              pathname: `/buckets/${bucketAddress}`,
              query: {
                path: commonPrefix,
                ...(delimiter !== "/" ? { delimiter } : {}),
              },
            }}
            className="flex items-center gap-4 justify-self-start"
          >
            <Folder className="text-primary" />
            <span className="font-mono truncate">{removePrefix(commonPrefix, parentPath)}</span>
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
