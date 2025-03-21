import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useState } from "react";
import TimeAgo from "javascript-time-ago";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { Badge } from "@recallnet/ui/components/badge";
import { cn } from "@recallnet/ui/lib/utils";

import BucketNameDisplay from "./bucket-name-display";
import BucketActivity from "./bucket-activity";

const timeAgo = new TimeAgo("en-US");

interface Props {
  bucket: {
    addr: string;
    metadata: readonly {
      key: string;
      value: string;
    }[];
  };
}

function getActivityStatus(lastActivity: string | undefined) {
  if (!lastActivity) return { color: "text-gray-500", label: "No activity" };
  const date = new Date(lastActivity);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 1) return { color: "text-green-500", label: "Active" };
  if (hours < 24) return { color: "text-yellow-500", label: "Recent" };
  return { color: "text-gray-500", label: "Inactive" };
}

export default function BucketCard({ bucket }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract relevant metadata
  const lastActivity = bucket.metadata.find((m) => m.key === "lastActivity")?.value;
  const activityStatus = getActivityStatus(lastActivity);

  // Convert metadata to activities
  const activities = bucket.metadata
    .filter((m) => !["name", "type", "lastActivity"].includes(m.key))
    .map((m) => ({
      type: "metadata" as const,
      timestamp: new Date().toISOString(),
      details: `${m.key}: ${m.value}`,
    }));

  return (
    <Card className="rounded-none hover:bg-accent/5 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BucketNameDisplay addr={bucket.addr} metadata={bucket.metadata} />
              <Badge variant="outline" className={cn("ml-2", activityStatus.color)}>
                {activityStatus.label}
              </Badge>
            </div>
          </div>
          {!isOpen && (
            <ChevronDown
              className="opacity-40 hover:opacity-100 cursor-pointer mt-1"
              onClick={() => setIsOpen(true)}
            />
          )}
          {isOpen && (
            <ChevronUp
              className="opacity-40 hover:opacity-100 cursor-pointer mt-1"
              onClick={() => setIsOpen(false)}
            />
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && bucket.metadata.length > 0 && (
        <CardContent>
          <div className="flex flex-col gap-4">
            <BucketActivity activities={activities} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
