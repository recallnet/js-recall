"use client";

import { ChevronDown, ChevronUp, Clock, FileText } from "lucide-react";
import { useState } from "react";

import { Badge } from "@recall/ui/components/badge";
import { Button } from "@recall/ui/components/button";
import { Card, CardContent } from "@recall/ui/components/card";

import type { AgentActivity } from "@/types/agent-activity";

interface AgentActivityEntryProps {
  activity: AgentActivity;
}

export function AgentActivityEntry({ activity }: AgentActivityEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = Number.parseInt(
      Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
    );
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Card className="mb-4 rounded-none">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{activity.filename}</h3>
            <p className="text-sm text-muted-foreground">
              {formatDate(activity.timestamp)}
            </p>
          </div>
          <Badge variant="secondary">{activity.agent}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center">
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{formatFileSize(activity.fileSize)}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
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
          <div className="mt-4 p-4 bg-muted rounded-md">
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(activity.metadata, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
