"use server";

import type { AgentActivity } from "@/types/agent-activity";

export async function fetchAgentActivity(
  page: number,
  pageSize: number,
): Promise<AgentActivity[]> {
  // Simulate API call with a delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock data generation
  const startDate = new Date();
  startDate.setMinutes(startDate.getMinutes() - page * pageSize);

  return Array.from({ length: pageSize }, (_, i) => {
    const date = new Date(startDate);
    date.setMinutes(date.getMinutes() - i);
    return {
      id: `activity-${page * pageSize + i}`,
      timestamp: date.toISOString(),
      filename: `file-${Math.floor(Math.random() * 1000)}.txt`,
      fileSize: Math.floor(Math.random() * 1000000),
      timeToLive: Math.floor(Math.random() * 72) + 1,
      agent: `Agent-${Math.floor(Math.random() * 10) + 1}`,
      metadata: {
        version: `1.${Math.floor(Math.random() * 10)}`,
        tags: ["tag1", "tag2", "tag3"].slice(
          0,
          Math.floor(Math.random() * 3) + 1,
        ),
        priority: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
        processingTime: Math.floor(Math.random() * 1000) + 100,
      },
    };
  }).reverse();
}
