import { ChevronDown, ChevronUp, File } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Address } from "viem";

import CollapsedStringDisplay from "@recallnet/ui/components/collapsed-string-display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";

import Metric from "@/components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";
import { formatBytes } from "@/lib/format-bytes";
import { removePrefix } from "@/lib/remove-prefix";

interface Props {
  bucketAddress: Address;
  parentPath: string;
  object: {
    key: string;
    state: {
      blobHash: string;
      size: bigint;
      metadata: readonly {
        key: string;
        value: string;
      }[];
    };
  };
  delimiter: string;
}

export default function ObjectListItem({
  bucketAddress,
  parentPath,
  object,
  delimiter,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const size = formatBytes(Number(object.state.size));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <Link
            href={{
              pathname: `/buckets/${bucketAddress}`,
              query: {
                path: object.key,
                ...(delimiter !== "/" ? { delimiter } : {}),
              },
            }}
            className="flex items-center gap-4"
          >
            <File />
            {removePrefix(object.key, parentPath)}
          </Link>
          {!isOpen && (
            <ChevronDown
              className="ml-auto opacity-40 hover:opacity-100"
              onClick={() => setIsOpen(true)}
            />
          )}
          {isOpen && (
            <ChevronUp
              className="ml-auto opacity-40 hover:opacity-100"
              onClick={() => setIsOpen(false)}
            />
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="grid grid-cols-2 gap-6">
          <Metric
            title="Blob Hash"
            value={
              <CollapsedStringDisplay
                value={object.state.blobHash}
                showCopy
                copyTooltip="Copy blob hash"
                copySuccessMessage="Blob hash copied"
              />
            }
            valueTooltip={object.state.blobHash}
          />
          <Metric title="Size" value={size.val} subtitle={size.unit} />
          <div className="col-span-2 flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Metadata</span>
            <pre className="text-muted-foreground min-h-12 border p-4 font-mono">
              {arrayToDisplay(object.state.metadata)}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
