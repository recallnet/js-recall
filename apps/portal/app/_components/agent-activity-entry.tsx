"use client";

import { ChevronDown, ChevronUp, Clock, FileText } from "lucide-react";
import { useState } from "react";

import { Badge } from "@recallnet/ui/components/shadcn/badge";
import { Button } from "@recallnet/ui/components/shadcn/button";
import { Card, CardContent } from "@recallnet/ui/components/shadcn/card";

import { formatBytes } from "@/lib/format-bytes";
import type { AgentActivity } from "@/types/agent-activity";

interface AgentActivityEntryProps {
  activity: AgentActivity;
}

export function AgentActivityEntry({ activity }: AgentActivityEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="mb-4 rounded-none">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="mb-1 text-lg font-semibold">{activity.filename}</h3>
            <p className="text-muted-foreground text-sm">
              {formatDate(activity.timestamp)}
            </p>
          </div>
          <Badge variant="secondary">{activity.agent}</Badge>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <FileText className="text-muted-foreground mr-2 h-4 w-4" />
            <span className="text-sm">
              {formatBytes(activity.fileSize).formatted}
            </span>
          </div>
          <div className="flex items-center">
            <Clock className="text-muted-foreground mr-2 h-4 w-4" />
            <span className="text-sm">{activity.timeToLive} hours TTL</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Hide Metadata
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Show Metadata
            </>
          )}
        </Button>
        {isExpanded && (
          <div className="bg-muted mt-4 rounded-md p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {JSON.stringify(activity.metadata, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
