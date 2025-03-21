import { Database } from "lucide-react";
import Link from "next/link";

import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";

interface Props {
  addr: string;
  metadata: readonly {
    key: string;
    value: string;
  }[];
}

export default function BucketNameDisplay({ addr, metadata }: Props) {
  // Extract bucket name from metadata if it exists
  const bucketName = metadata.find((m) => m.key === "name")?.value;
  const bucketType = metadata.find((m) => m.key === "type")?.value;

  return (
    <Link href={`/buckets/${addr}`} className="flex items-center gap-4 group">
      <Database className="text-primary" />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {bucketName ? (
            <span className="font-mono text-lg font-semibold text-primary">
              {bucketName}
            </span>
          ) : null}
          <CollapsedStringDisplay
            value={addr}
            showCopy
            copyTooltip="Copy bucket address"
            copySuccessMessage="Bucket address copied"
            className={`text-sm ${bucketName ? "text-muted-foreground" : "text-primary"}`}
          />
        </div>
        {bucketType && (
          <span className="text-xs text-muted-foreground font-mono">
            type: <span className="text-accent-foreground">{bucketType}</span>
          </span>
        )}
      </div>
    </Link>
  );
}