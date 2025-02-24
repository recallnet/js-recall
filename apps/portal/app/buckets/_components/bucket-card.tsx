import { ChevronDown, ChevronUp, Database } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";

import { arrayToDisplay } from "@/lib/convert-matadata";

interface Props {
  bucket: {
    addr: string;
    metadata: readonly {
      key: string;
      value: string;
    }[];
  };
}

export default function BucketCard({ bucket }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <Link
            href={`/buckets/${bucket.addr}`}
            className="flex items-center gap-4"
          >
            <Database />
            <CollapsedStringDisplay
              value={bucket.addr}
              showCopy
              copyTooltip="Copy bucket address"
              copySuccessMessage="Bucket address copied"
            />
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
          <div className="col-span-2 flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Metadata</span>
            <pre className="text-muted-foreground min-h-12 border p-4">
              {arrayToDisplay(bucket.metadata)}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
