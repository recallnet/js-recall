/**
 * Represents an activity performed by an agent in the Recall system
 *
 * @interface AgentActivity
 * @property {string} id - Unique identifier for the activity
 * @property {string} timestamp - ISO timestamp when the activity occurred
 * @property {string} filename - Name of the file associated with the activity
 * @property {number} fileSize - Size of the file in bytes
 * @property {number} timeToLive - Time to live for the activity in seconds
 * @property {string} agent - Identifier for the agent that performed the activity
 * @property {Record<string, unknown>} metadata - Additional metadata associated with the activity
 */
export interface AgentActivity {
  id: string;
  timestamp: string;
  filename: string;
  fileSize: number;
  timeToLive: number;
  agent: string;
  metadata: Record<string, unknown>;
}
