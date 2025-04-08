import { Folder } from "lucide-react";
import Link from "next/link";
import { Address } from "viem";

import {
  Card,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";

import { removePrefix } from "@/lib/remove-prefix";

export default function PrefixListItem({
  bucketAddress,
  parentPath,
  commonPrefix,
  delimiter,
}: {
  bucketAddress: Address;
  parentPath: string;
  commonPrefix: string;
  delimiter: string;
}) {
  return (
    <Card key={commonPrefix} className="rounded-none">
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
            <Folder />
            {removePrefix(commonPrefix, parentPath)}
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
