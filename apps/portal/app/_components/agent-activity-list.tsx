"use client";

import type { AgentActivity } from "@/types/agent-activity";

import { AgentActivityEntry } from "./agent-activity-entry";

interface AgentActivityListProps {
  activities: AgentActivity[];
}

export function AgentActivityList({ activities }: AgentActivityListProps) {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <AgentActivityEntry key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
