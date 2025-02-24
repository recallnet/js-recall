import { Folder } from "lucide-react";
import Link from "next/link";
import { Address } from "viem";

import { Card, CardHeader, CardTitle } from "@recallnet/ui/components/card";

export default function PrefixListItem({
  bucketAddress,
  commonPrefix,
  label,
}: {
  bucketAddress: Address;
  commonPrefix: string;
  label: string;
}) {
  return (
    <Card key={commonPrefix} className="rounded-none">
      <CardHeader>
        <CardTitle>
          <Link
            key={commonPrefix}
            href={`/buckets/${bucketAddress}/${commonPrefix}`}
            className="flex items-center gap-4 justify-self-start"
          >
            <Folder />
            {label}
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
