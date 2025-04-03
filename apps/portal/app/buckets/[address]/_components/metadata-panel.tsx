/**
 * A component to display object metadata in a more compact format.
 * Designed to be used alongside the file preview area.
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import CollapsedStringDisplay from "@recallnet/ui/recall/collapsed-string-display";

import Metric from "@/components/metric";
import { arrayToDisplay } from "@/lib/convert-matadata";

interface MetadataPanelProps {
  object: {
    blobHash: string;
    recoveryHash: string;
    size: bigint;
    expiry: bigint;
    metadata: readonly {
      key: string;
      value: string;
    }[];
  };
  objectSize: {
    val: number;
    unit: string;
  };
  objectExpiryDisplay?: string;
  objectExpiryIso?: string;
  objectBlockDiff?: bigint;
}

export function MetadataPanel({
  object,
  objectSize,
  objectExpiryDisplay,
  objectExpiryIso,
  objectBlockDiff,
}: MetadataPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t">
      <div
        className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-3"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium">Object Metadata</h3>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Metric
              title="Blob Hash"
              value={
                <CollapsedStringDisplay
                  value={object.blobHash}
                  showCopy
                  copyTooltip="Copy blob hash"
                  copySuccessMessage="Blob hash copied"
                />
              }
              valueTooltip={object.blobHash}
            />
            <Metric
              title="Recovery Hash"
              value={
                <CollapsedStringDisplay
                  value={object.recoveryHash}
                  showCopy
                  copyTooltip="Copy recovery hash"
                  copySuccessMessage="Recovery hash copied"
                />
              }
              valueTooltip={object.recoveryHash}
            />
            <Metric
              title="Size"
              value={objectSize.val}
              subtitle={objectSize.unit}
            />
            <Metric
              title={`Expire${(objectBlockDiff || 1n) < 0n ? "d" : "s"}`}
              value={objectExpiryDisplay}
              valueTooltip={objectExpiryIso}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Properties</span>
            <pre className="text-muted-foreground max-h-40 min-h-12 overflow-auto border p-4 font-mono text-xs">
              {arrayToDisplay(object.metadata)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
