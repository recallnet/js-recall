import { Clock, Database, FileText, History, Trash, Upload } from "lucide-react";
import TimeAgo from "javascript-time-ago";

import { cn } from "@recallnet/ui/lib/utils";

const timeAgo = new TimeAgo("en-US");

interface Activity {
  type: "upload" | "delete" | "metadata";
  timestamp: string;
  details: string;
}

interface Props {
  activities?: Activity[];
  className?: string;
}

function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "upload":
      return Upload;
    case "delete":
      return Trash;
    case "metadata":
      return Database;
    default:
      return Clock;
  }
}

function getActivityColor(type: Activity["type"]) {
  switch (type) {
    case "upload":
      return "text-green-500";
    case "delete":
      return "text-red-500";
    case "metadata":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

export default function BucketActivity({ activities = [], className }: Props) {
  if (activities.length === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground text-xs font-mono">Metadata</span>
        </div>
        <div className="text-sm text-muted-foreground italic">
          No metadata available
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground text-xs font-mono">Metadata</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {activities.map((activity, index) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);
          return (
            <div
              key={index}
              className="flex items-center gap-2 text-sm"
            >
              <Icon className={cn("h-4 w-4", color)} />
              <span className="flex-1">{activity.details}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}