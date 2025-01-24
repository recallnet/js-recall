export interface AgentActivity {
  id: string;
  timestamp: string;
  filename: string;
  fileSize: number;
  timeToLive: number;
  agent: string;
  metadata: Record<string, unknown>;
}
