import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";

import BucketNameDisplay from "./bucket-name-display";

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

  // Filter out name and type from metadata display since they're shown in the title
  const displayMetadata = bucket.metadata.filter(
    (m) => !["name", "type"].includes(m.key)
  );

  return (
    <Card className="rounded-none hover:bg-accent/5 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <BucketNameDisplay addr={bucket.addr} metadata={bucket.metadata} />
          {!isOpen && (
            <ChevronDown
              className="ml-auto opacity-40 hover:opacity-100 cursor-pointer"
              onClick={() => setIsOpen(true)}
            />
          )}
          {isOpen && (
            <ChevronUp
              className="ml-auto opacity-40 hover:opacity-100 cursor-pointer"
              onClick={() => setIsOpen(false)}
            />
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && displayMetadata.length > 0 && (
        <CardContent>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-mono">Additional Metadata</span>
            <div className="grid grid-cols-2 gap-4">
              {displayMetadata.map((meta) => (
                <div key={meta.key} className="font-mono text-sm">
                  <span className="text-muted-foreground">{meta.key}:</span>{" "}
                  <span className="text-accent-foreground">{meta.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
